import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Embed,
  type Guild,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type ModalSubmitInteraction,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors, infoEmbed, successEmbed } from "../../lib/embeds.js";
import { formatChannel, formatHelpEntry } from "../../lib/formatters.js";
import { utilityCommandIdFor } from "../../lib/register-slash.js";
import { botHasChannelPermission, canManageMessages } from "./access.js";
import { auditUtility } from "./audit.js";
import { fetchGuildMessage, fetchPostChannel, isBotMessage, isPostChannel } from "./channels.js";
import { parseColor, parseHttpUrl } from "./parse.js";
import {
  MAX_EMBED_FIELDS,
  clearSession,
  requireSession,
  saveSession,
  type EmbedDraft,
  type EmbedSession,
} from "./session.js";
import { utilityError } from "./view.js";

function optionalUrl(input: string): string | undefined | "invalid" {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  return parseHttpUrl(trimmed) ?? "invalid";
}

function draftFromEmbed(embed: Embed): EmbedDraft {
  return {
    title: embed.title ?? undefined,
    description: embed.description ?? undefined,
    color: embed.color ?? undefined,
    authorName: embed.author?.name ?? undefined,
    authorIcon: embed.author?.iconURL ?? undefined,
    authorUrl: embed.author?.url ?? undefined,
    footerText: embed.footer?.text ?? undefined,
    footerIcon: embed.footer?.iconURL ?? undefined,
    thumbnail: embed.thumbnail?.url ?? undefined,
    image: embed.image?.url ?? undefined,
    timestampMs: embed.timestamp ? Date.parse(embed.timestamp) : undefined,
    fields: embed.fields.map((field) => ({
      name: field.name,
      value: field.value,
      inline: field.inline ?? false,
    })),
  };
}

function hasPublishableContent(draft: EmbedDraft): boolean {
  return Boolean(
    draft.title ||
      draft.description ||
      draft.authorName ||
      draft.footerText ||
      draft.thumbnail ||
      draft.image ||
      draft.fields.length > 0,
  );
}

function buildDraftEmbed(draft: EmbedDraft, preview: boolean): EmbedBuilder {
  const embed = new EmbedBuilder();
  if (draft.color != null) {
    embed.setColor(draft.color);
  }
  if (draft.title) {
    embed.setTitle(draft.title);
  }
  if (draft.description) {
    embed.setDescription(draft.description);
  } else if (preview && !hasPublishableContent(draft)) {
    embed.setDescription("*Empty draft. Use the buttons to add content.*").setColor(embedColors.info);
  }
  if (draft.authorName) {
    embed.setAuthor({
      name: draft.authorName,
      ...(draft.authorIcon ? { iconURL: draft.authorIcon } : {}),
      ...(draft.authorUrl ? { url: draft.authorUrl } : {}),
    });
  }
  if (draft.footerText) {
    embed.setFooter({
      text: draft.footerText,
      ...(draft.footerIcon ? { iconURL: draft.footerIcon } : {}),
    });
  }
  if (draft.thumbnail) {
    embed.setThumbnail(draft.thumbnail);
  }
  if (draft.image) {
    embed.setImage(draft.image);
  }
  if (draft.timestampMs != null) {
    embed.setTimestamp(draft.timestampMs);
  }
  if (draft.fields.length > 0) {
    embed.addFields(draft.fields);
  }
  return embed;
}

function controlRows(draft: EmbedDraft): ActionRowBuilder<ButtonBuilder>[] {
  const btn = (id: string, label: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:eb:title", "Title"),
      btn("utility:eb:desc", "Description"),
      btn("utility:eb:color", "Color"),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:eb:author", "Author"),
      btn("utility:eb:footer", "Footer"),
      btn("utility:eb:thumb", "Thumbnail"),
      btn("utility:eb:image", "Image"),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:eb:field", "Add field"),
      btn("utility:eb:rmfield", "Remove field").setDisabled(draft.fields.length === 0),
      btn("utility:eb:ts", draft.timestampMs != null ? "Clear time" : "Timestamp"),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:eb:go", "Publish", ButtonStyle.Success),
      btn("utility:eb:stop", "Cancel", ButtonStyle.Danger),
    ),
  ];
}

function builderPayload(guild: Guild, session: EmbedSession): InteractionReplyOptions & InteractionUpdateOptions {
  const target = formatChannel(guild, session.channelId);
  const mode = session.edit
    ? `Editing message \`${session.edit.messageId}\` in ${formatChannel(guild, session.edit.channelId)}.`
    : `New embed. Publishes to ${target}.`;
  return {
    content: `${emojis.info} **Embed builder** · ${mode}\n*Session expires after 15 minutes of inactivity.*`,
    embeds: [buildDraftEmbed(session.draft, true)],
    components: controlRows(session.draft),
    allowedMentions: { parse: [] },
  };
}

function textModal(id: string, title: string, label: string, value: string | undefined, paragraph: boolean, max: number) {
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label)
    .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(max);
  if (value) {
    input.setValue(value.slice(0, max));
  }
  return new ModalBuilder()
    .setCustomId(id)
    .setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

async function denyBuilder(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction) {
  const payload = utilityError("Manage Messages required", "You need **Manage Messages** to use the embed builder.");
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
    return;
  }
  await interaction.reply(payload);
}

export async function handleEmbedCreate(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!canManageMessages(interaction)) {
    await denyBuilder(interaction);
    return;
  }

  const channel = interaction.options.getChannel("channel", true);
  if (!isPostChannel(channel)) {
    await interaction.reply(utilityError("Text channel required", "Pick a text or announcement channel."));
    return;
  }

  const session = saveSession({
    kind: "embed",
    userId: interaction.user.id,
    guildId: guild.id,
    channelId: channel.id,
    draft: { fields: [] },
    expiresAt: 0,
  });
  await interaction.reply({ ...builderPayload(guild, session), flags: MessageFlags.Ephemeral });
}

export async function handleEmbedEdit(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!canManageMessages(interaction)) {
    await denyBuilder(interaction);
    return;
  }

  const messageId = interaction.options.getString("message_id", true).trim();
  const channelId = interaction.options.getChannel("message_channel")?.id ?? interaction.channelId;
  if (!channelId) {
    await interaction.reply(utilityError("No channel", "I could not tell which channel holds that message."));
    return;
  }

  const fetched = await fetchGuildMessage(guild, channelId, messageId);
  if (typeof fetched === "string") {
    await interaction.reply(utilityError("Message not found", fetched));
    return;
  }

  if (!isBotMessage(fetched.message, interaction.client.user?.id)) {
    await interaction.reply(utilityError("Not my message", "I can only rewrite embeds that I posted."));
    return;
  }
  if (fetched.message.flags.has(MessageFlags.IsComponentsV2)) {
    await interaction.reply(
      utilityError(
        "That's Components V2",
        `Use ${formatHelpEntry("utility edit_v2", utilityCommandIdFor(guild.id))} to rewrite a Components V2 message.`,
      ),
    );
    return;
  }
  const embed = fetched.message.embeds[0];
  if (!embed) {
    await interaction.reply(utilityError("No embed", "That message has no embed to rewrite."));
    return;
  }

  const session = saveSession({
    kind: "embed",
    userId: interaction.user.id,
    guildId: guild.id,
    channelId: fetched.channel.id,
    edit: { channelId: fetched.channel.id, messageId: fetched.message.id },
    draft: draftFromEmbed(embed),
    expiresAt: 0,
  });
  await interaction.reply({ ...builderPayload(guild, session), flags: MessageFlags.Ephemeral });
}

async function refreshBuilder(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  guild: Guild,
  session: EmbedSession,
): Promise<void> {
  const payload = builderPayload(guild, saveSession(session));
  if (interaction.isModalSubmit()) {
    if (interaction.isFromMessage()) {
      await interaction.update(payload);
      return;
    }
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update(payload);
}

export async function handleEmbedButton(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  if (!canManageMessages(interaction)) {
    await denyBuilder(interaction);
    return;
  }

  const session = requireSession(guild.id, interaction.user.id, "embed");
  if (!session) {
    await interaction.reply(
      utilityError(
        "Builder expired",
        `Start again with ${formatHelpEntry("utility embed", utilityCommandIdFor(guild.id))} or ${formatHelpEntry("utility edit_embed", utilityCommandIdFor(guild.id))}.`,
      ),
    );
    return;
  }

  const action = interaction.customId.slice("utility:eb:".length);
  if (action === "stop") {
    clearSession(guild.id, interaction.user.id);
    await interaction.update({
      content: null,
      embeds: [infoEmbed("Builder closed", "The embed draft was discarded. Nothing was posted.")],
      components: [],
    });
    return;
  }

  if (action === "rmfield") {
    session.draft.fields.pop();
    await refreshBuilder(interaction, guild, session);
    return;
  }

  if (action === "ts") {
    session.draft.timestampMs = session.draft.timestampMs != null ? undefined : Date.now();
    await refreshBuilder(interaction, guild, session);
    return;
  }

  if (action === "go") {
    await publishEmbed(interaction, guild, session);
    return;
  }

  const modals: Record<string, ModalBuilder> = {
    title: textModal("utility:eb:m:title", "Embed title", "Title", session.draft.title, false, 256),
    desc: textModal("utility:eb:m:desc", "Embed description", "Description", session.draft.description, true, 4000),
    color: textModal("utility:eb:m:color", "Embed color", "Hex, name, or number", session.draft.color?.toString(16).padStart(6, "0"), false, 32),
    thumb: textModal("utility:eb:m:thumb", "Thumbnail URL", "Image URL", session.draft.thumbnail, false, 500),
    image: textModal("utility:eb:m:image", "Image URL", "Image URL", session.draft.image, false, 500),
  };

  if (action === "author") {
    const name = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Author name")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256);
    const icon = new TextInputBuilder()
      .setCustomId("icon")
      .setLabel("Author icon URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);
    const url = new TextInputBuilder()
      .setCustomId("url")
      .setLabel("Author URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);
    if (session.draft.authorName) name.setValue(session.draft.authorName);
    if (session.draft.authorIcon) icon.setValue(session.draft.authorIcon);
    if (session.draft.authorUrl) url.setValue(session.draft.authorUrl);
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("utility:eb:m:author")
        .setTitle("Embed author")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(name),
          new ActionRowBuilder<TextInputBuilder>().addComponents(icon),
          new ActionRowBuilder<TextInputBuilder>().addComponents(url),
        ),
    );
    return;
  }

  if (action === "footer") {
    const text = new TextInputBuilder()
      .setCustomId("text")
      .setLabel("Footer text")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);
    const icon = new TextInputBuilder()
      .setCustomId("icon")
      .setLabel("Footer icon URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);
    if (session.draft.footerText) text.setValue(session.draft.footerText);
    if (session.draft.footerIcon) icon.setValue(session.draft.footerIcon);
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("utility:eb:m:footer")
        .setTitle("Embed footer")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(text),
          new ActionRowBuilder<TextInputBuilder>().addComponents(icon),
        ),
    );
    return;
  }

  if (action === "field") {
    if (session.draft.fields.length >= MAX_EMBED_FIELDS) {
      await interaction.reply(utilityError("Field limit", `An embed can have at most **${MAX_EMBED_FIELDS}** fields.`));
      return;
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("utility:eb:m:field")
        .setTitle("Add embed field")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("name").setLabel("Name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("value")
              .setLabel("Value")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1024),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("inline")
              .setLabel("Inline? (true / false)")
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(5)
              .setValue("false"),
          ),
        ),
    );
    return;
  }

  const modal = modals[action];
  if (modal) {
    await interaction.showModal(modal);
  }
}

export async function handleEmbedModal(interaction: ModalSubmitInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const session = requireSession(guild.id, interaction.user.id, "embed");
  if (!session) {
    await interaction.reply(
      utilityError(
        "Builder expired",
        `Start again with ${formatHelpEntry("utility embed", utilityCommandIdFor(guild.id))} or ${formatHelpEntry("utility edit_embed", utilityCommandIdFor(guild.id))}.`,
      ),
    );
    return;
  }

  const which = interaction.customId.slice("utility:eb:m:".length);
  const draft = session.draft;

  if (which === "title") {
    draft.title = interaction.fields.getTextInputValue("value").trim() || undefined;
  } else if (which === "desc") {
    draft.description = interaction.fields.getTextInputValue("value").trim() || undefined;
  } else if (which === "color") {
    const raw = interaction.fields.getTextInputValue("value").trim();
    if (!raw) {
      draft.color = undefined;
    } else {
      const color = parseColor(raw);
      if (color == null) {
        await interaction.reply(utilityError("Invalid color", "Use a hex code (`#5865F2`), a name (`blurple`), or a number."));
        return;
      }
      draft.color = color;
    }
  } else if (which === "thumb" || which === "image") {
    const parsed = optionalUrl(interaction.fields.getTextInputValue("value"));
    if (parsed === "invalid") {
      await interaction.reply(utilityError("Invalid URL", "Use an `http://` or `https://` image link."));
      return;
    }
    if (which === "thumb") {
      draft.thumbnail = parsed;
    } else {
      draft.image = parsed;
    }
  } else if (which === "author") {
    const name = interaction.fields.getTextInputValue("name").trim();
    const icon = optionalUrl(interaction.fields.getTextInputValue("icon"));
    const url = optionalUrl(interaction.fields.getTextInputValue("url"));
    if (icon === "invalid" || url === "invalid") {
      await interaction.reply(utilityError("Invalid URL", "Author icon and URL must be `http://` or `https://` links."));
      return;
    }
    draft.authorName = name || undefined;
    draft.authorIcon = icon;
    draft.authorUrl = url;
    if (!draft.authorName) {
      draft.authorIcon = undefined;
      draft.authorUrl = undefined;
    }
  } else if (which === "footer") {
    const text = interaction.fields.getTextInputValue("text").trim();
    const icon = optionalUrl(interaction.fields.getTextInputValue("icon"));
    if (icon === "invalid") {
      await interaction.reply(utilityError("Invalid URL", "Footer icon must be an `http://` or `https://` link."));
      return;
    }
    draft.footerText = text || undefined;
    draft.footerIcon = icon;
    if (!draft.footerText) {
      draft.footerIcon = undefined;
    }
  } else if (which === "field") {
    draft.fields.push({
      name: interaction.fields.getTextInputValue("name").trim(),
      value: interaction.fields.getTextInputValue("value").trim(),
      inline: interaction.fields.getTextInputValue("inline").trim().toLowerCase() === "true",
    });
  }

  await refreshBuilder(interaction, guild, session);
}

async function publishEmbed(interaction: ButtonInteraction, guild: Guild, session: EmbedSession): Promise<void> {
  if (!hasPublishableContent(session.draft)) {
    await interaction.reply(utilityError("Empty embed", "Add a title, description, field, or image before publishing."));
    return;
  }

  const channel = await fetchPostChannel(guild, session.edit?.channelId ?? session.channelId);
  if (!channel) {
    await interaction.reply(utilityError("Channel missing", "The target channel is gone. Close this builder and start again."));
    return;
  }

  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
  if (!needed.every((bit) => botHasChannelPermission(channel, bit))) {
    await interaction.reply(
      utilityError("I cannot post there", `I need **View Channel**, **Send Messages**, and **Embed Links** in ${formatChannel(guild, channel.id)}.`),
    );
    return;
  }

  const embed = buildDraftEmbed(session.draft, false);
  try {
    if (session.edit) {
      const fetched = await fetchGuildMessage(guild, session.edit.channelId, session.edit.messageId);
      if (typeof fetched === "string") {
        await interaction.reply(utilityError("Message not found", fetched));
        return;
      }
      await fetched.message.edit({ embeds: [embed], content: fetched.message.content || undefined });
    } else {
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    }
  } catch {
    await interaction.reply(
      utilityError(
        session.edit ? "Could not edit embed" : "Could not publish embed",
        "Discord refused the message. Check my permissions and that URLs still resolve.",
      ),
    );
    return;
  }

  clearSession(guild.id, interaction.user.id);
  const copy = session.edit
    ? `Rewrote the embed in ${formatChannel(guild, channel.id)}.`
    : `Posted the embed in ${formatChannel(guild, channel.id)}.`;
  await interaction.update({
    content: null,
    embeds: [successEmbed(session.edit ? "Embed updated" : "Embed published", copy)],
    components: [],
  });

  await auditUtility(
    interaction,
    guild,
    session.edit ? "A bot embed was rewritten." : "An embed was published.",
    [
      `**Channel:** ${formatChannel(guild, channel.id)}`,
      session.edit ? `**Message:** \`${session.edit.messageId}\`` : `**Title:** ${session.draft.title ?? "*none*"}`,
    ],
  );
}
