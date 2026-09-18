import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  ContainerComponent,
  MediaGalleryComponent,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SectionComponent,
  SeparatorComponent,
  TextDisplayComponent,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailComponent,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type Message,
  type ModalSubmitInteraction,
  type TopLevelComponent,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatHelpEntry } from "../../lib/formatters.js";
import { utilityCommandIdFor } from "../../lib/register-slash.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { botHasChannelPermission, canManageMessages } from "./access.js";
import { auditUtility } from "./audit.js";
import { fetchGuildMessage, fetchPostChannel, isBotMessage, isPostChannel } from "./channels.js";
import { parseColor, parseHttpUrl } from "./parse.js";
import {
  MAX_V2_BLOCKS,
  clearSession,
  requireSession,
  saveSession,
  type V2Block,
  type V2Draft,
  type V2Session,
} from "./session.js";
import { asMessageEdit, utilityError, utilityInfo, utilitySuccess } from "./view.js";

function optionalUrl(input: string): string | undefined | "invalid" {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  return parseHttpUrl(trimmed) ?? "invalid";
}

function parseChild(component: TopLevelComponent | ContainerComponent["components"][number], blocks: V2Block[]): void {
  if (component.type === ComponentType.TextDisplay && component instanceof TextDisplayComponent) {
    blocks.push({ type: "text", content: component.content });
    return;
  }
  if (component.type === ComponentType.Separator && component instanceof SeparatorComponent) {
    blocks.push({ type: "separator" });
    return;
  }
  if (component.type === ComponentType.MediaGallery && component instanceof MediaGalleryComponent) {
    const url = component.items[0]?.media.url;
    if (url) {
      blocks.push({ type: "media", url });
    }
    return;
  }
  if (component.type === ComponentType.Section && component instanceof SectionComponent) {
    const texts = component.components.map((entry) => entry.content);
    const accessory = component.accessory;
    const thumbnail = accessory instanceof ThumbnailComponent ? accessory.media.url : undefined;
    blocks.push({
      type: "section",
      heading: texts[0] ?? "",
      extra: texts.slice(1).join("\n") || undefined,
      thumbnail,
    });
  }
}

function draftFromMessage(message: Message): V2Draft {
  const blocks: V2Block[] = [];
  let accentColor: number | undefined;
  for (const top of message.components) {
    if (top.type === ComponentType.Container && top instanceof ContainerComponent) {
      if (accentColor == null && top.accentColor != null) {
        accentColor = top.accentColor;
      }
      for (const child of top.components) {
        parseChild(child, blocks);
      }
      continue;
    }
    parseChild(top, blocks);
  }
  return { accentColor, blocks: blocks.slice(0, MAX_V2_BLOCKS) };
}

function buildContentContainer(draft: V2Draft, preview: boolean): ContainerBuilder {
  const container = new ContainerBuilder();
  if (draft.accentColor != null) {
    container.setAccentColor(draft.accentColor);
  } else if (preview) {
    container.setAccentColor(embedColors.info);
  }

  if (draft.blocks.length === 0) {
    if (preview) {
      container.addTextDisplayComponents(
        textBlock("*Empty draft. Add text, a section, a divider, or an image.*"),
      );
    }
    return container;
  }

  for (const block of draft.blocks) {
    if (block.type === "text") {
      container.addTextDisplayComponents(textBlock(block.content));
      continue;
    }
    if (block.type === "separator") {
      container.addSeparatorComponents(divider());
      continue;
    }
    if (block.type === "media") {
      container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(block.url)));
      continue;
    }
    if (block.thumbnail) {
      container.addSectionComponents(headingWithThumbnail(block.heading, block.thumbnail, block.extra));
      continue;
    }
    const texts = [block.heading];
    if (block.extra) {
      texts.push(block.extra);
    }
    container.addTextDisplayComponents(...texts.map((entry) => textBlock(entry)));
  }
  return container;
}

function controlRows(draft: V2Draft): ActionRowBuilder<ButtonBuilder>[] {
  const btn = (id: string, label: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:v2:text", "Add text"),
      btn("utility:v2:section", "Add section"),
      btn("utility:v2:sep", "Add divider"),
      btn("utility:v2:media", "Add image"),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:v2:color", "Accent color"),
      btn("utility:v2:undo", "Undo last").setDisabled(draft.blocks.length === 0),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn("utility:v2:go", "Publish", ButtonStyle.Success),
      btn("utility:v2:stop", "Cancel", ButtonStyle.Danger),
    ),
  ];
}

function builderPayload(guild: Guild, session: V2Session): InteractionReplyOptions & InteractionUpdateOptions {
  const target = formatChannel(guild, session.channelId);
  const mode = session.edit
    ? `Editing message \`${session.edit.messageId}\` in ${formatChannel(guild, session.edit.channelId)}.`
    : `New Components V2 message. Publishes to ${target}.`;
  const controls = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.settings} Components V2 builder`),
      textBlock(`${mode}\n*Session expires after 15 minutes of inactivity. Markdown works in text blocks.*`),
    )
    .addSeparatorComponents(divider());

  for (const row of controlRows(session.draft)) {
    controls.addActionRowComponents(row);
  }

  return {
    flags: v2Flags,
    components: [buildContentContainer(session.draft, true), controls],
    allowedMentions: { parse: [] },
  };
}

function textModal(id: string, title: string, label: string, value: string | undefined, paragraph: boolean, max: number) {
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label)
    .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(true)
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
  const payload = utilityError(
    "Manage Messages required",
    "You need **Manage Messages** to use the Components V2 builder.",
  );
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
    return;
  }
  await interaction.reply(payload);
}

export async function handleV2Create(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
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
    kind: "v2",
    userId: interaction.user.id,
    guildId: guild.id,
    channelId: channel.id,
    draft: { blocks: [] },
    expiresAt: 0,
  });
  await interaction.reply({ ...builderPayload(guild, session), flags: [...v2Flags, MessageFlags.Ephemeral] });
}

export async function handleV2Edit(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
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
    await interaction.reply(utilityError("Not my message", "I can only rewrite Components V2 messages that I posted."));
    return;
  }
  if (!fetched.message.flags.has(MessageFlags.IsComponentsV2)) {
    await interaction.reply(
      utilityError(
        "That's a classic embed",
        `Use ${formatHelpEntry("utility edit_embed", utilityCommandIdFor(guild.id))} to rewrite an embed message.`,
      ),
    );
    return;
  }

  const session = saveSession({
    kind: "v2",
    userId: interaction.user.id,
    guildId: guild.id,
    channelId: fetched.channel.id,
    edit: { channelId: fetched.channel.id, messageId: fetched.message.id },
    draft: draftFromMessage(fetched.message),
    expiresAt: 0,
  });
  await interaction.reply({ ...builderPayload(guild, session), flags: [...v2Flags, MessageFlags.Ephemeral] });
}

async function refreshBuilder(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  guild: Guild,
  session: V2Session,
): Promise<void> {
  const payload = builderPayload(guild, saveSession(session));
  if (interaction.isModalSubmit()) {
    if (interaction.isFromMessage()) {
      await interaction.update(payload);
      return;
    }
    await interaction.reply({ ...payload, flags: [...v2Flags, MessageFlags.Ephemeral] });
    return;
  }
  await interaction.update(payload);
}

export async function handleV2Button(interaction: ButtonInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  if (!canManageMessages(interaction)) {
    await denyBuilder(interaction);
    return;
  }

  const session = requireSession(guild.id, interaction.user.id, "v2");
  if (!session) {
    await interaction.reply(
      utilityError(
        "Builder expired",
        `Start again with ${formatHelpEntry("utility v2", utilityCommandIdFor(guild.id))} or ${formatHelpEntry("utility edit_v2", utilityCommandIdFor(guild.id))}.`,
      ),
    );
    return;
  }

  const action = interaction.customId.slice("utility:v2:".length);
  if (action === "stop") {
    clearSession(guild.id, interaction.user.id);
    await interaction.update(asMessageEdit(utilityInfo("Builder closed", "The Components V2 draft was discarded. Nothing was posted.", false)));
    return;
  }

  if (action === "undo") {
    session.draft.blocks.pop();
    await refreshBuilder(interaction, guild, session);
    return;
  }

  if (action === "sep") {
    if (session.draft.blocks.length >= MAX_V2_BLOCKS) {
      await interaction.reply(utilityError("Component limit", `A draft can hold at most **${MAX_V2_BLOCKS}** blocks.`));
      return;
    }
    session.draft.blocks.push({ type: "separator" });
    await refreshBuilder(interaction, guild, session);
    return;
  }

  if (action === "go") {
    await publishV2(interaction, guild, session);
    return;
  }

  if (session.draft.blocks.length >= MAX_V2_BLOCKS && (action === "text" || action === "section" || action === "media")) {
    await interaction.reply(utilityError("Component limit", `A draft can hold at most **${MAX_V2_BLOCKS}** blocks.`));
    return;
  }

  if (action === "text") {
    await interaction.showModal(textModal("utility:v2:m:text", "Text display", "Markdown text", undefined, true, 4000));
    return;
  }
  if (action === "color") {
    await interaction.showModal(
      textModal(
        "utility:v2:m:color",
        "Accent color",
        "Hex, name, or number",
        session.draft.accentColor?.toString(16).padStart(6, "0"),
        false,
        32,
      ),
    );
    return;
  }
  if (action === "media") {
    await interaction.showModal(textModal("utility:v2:m:media", "Media gallery", "Image URL", undefined, false, 500));
    return;
  }
  if (action === "section") {
    const heading = new TextInputBuilder()
      .setCustomId("heading")
      .setLabel("Heading")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(256);
    const extra = new TextInputBuilder()
      .setCustomId("extra")
      .setLabel("Extra text")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);
    const thumb = new TextInputBuilder()
      .setCustomId("thumb")
      .setLabel("Thumbnail URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("utility:v2:m:section")
        .setTitle("Section")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(heading),
          new ActionRowBuilder<TextInputBuilder>().addComponents(extra),
          new ActionRowBuilder<TextInputBuilder>().addComponents(thumb),
        ),
    );
  }
}

export async function handleV2Modal(interaction: ModalSubmitInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const session = requireSession(guild.id, interaction.user.id, "v2");
  if (!session) {
    await interaction.reply(
      utilityError(
        "Builder expired",
        `Start again with ${formatHelpEntry("utility v2", utilityCommandIdFor(guild.id))} or ${formatHelpEntry("utility edit_v2", utilityCommandIdFor(guild.id))}.`,
      ),
    );
    return;
  }

  const which = interaction.customId.slice("utility:v2:m:".length);
  if (which === "text") {
    session.draft.blocks.push({ type: "text", content: interaction.fields.getTextInputValue("value").trim() });
  } else if (which === "media") {
    const url = parseHttpUrl(interaction.fields.getTextInputValue("value"));
    if (!url) {
      await interaction.reply(utilityError("Invalid URL", "Use an `http://` or `https://` image link."));
      return;
    }
    session.draft.blocks.push({ type: "media", url });
  } else if (which === "color") {
    const raw = interaction.fields.getTextInputValue("value").trim();
    if (!raw) {
      session.draft.accentColor = undefined;
    } else {
      const color = parseColor(raw);
      if (color == null) {
        await interaction.reply(utilityError("Invalid color", "Use a hex code (`#5865F2`), a name (`blurple`), or a number."));
        return;
      }
      session.draft.accentColor = color;
    }
  } else if (which === "section") {
    const heading = interaction.fields.getTextInputValue("heading").trim();
    const extra = interaction.fields.getTextInputValue("extra").trim() || undefined;
    const thumb = optionalUrl(interaction.fields.getTextInputValue("thumb"));
    if (thumb === "invalid") {
      await interaction.reply(utilityError("Invalid URL", "Thumbnail must be an `http://` or `https://` image link."));
      return;
    }
    session.draft.blocks.push({ type: "section", heading, extra, thumbnail: thumb });
  }

  await refreshBuilder(interaction, guild, session);
}

async function publishV2(interaction: ButtonInteraction, guild: Guild, session: V2Session): Promise<void> {
  if (session.draft.blocks.length === 0) {
    await interaction.reply(
      utilityError("Empty message", "Add text, a section, a divider, or an image before publishing."),
    );
    return;
  }

  const channel = await fetchPostChannel(guild, session.edit?.channelId ?? session.channelId);
  if (!channel) {
    await interaction.reply(utilityError("Channel missing", "The target channel is gone. Close this builder and start again."));
    return;
  }

  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
  if (!needed.every((bit) => botHasChannelPermission(channel, bit))) {
    await interaction.reply(
      utilityError("I cannot post there", `I need **View Channel** and **Send Messages** in ${formatChannel(guild, channel.id)}.`),
    );
    return;
  }

  const payload = {
    flags: v2Flags,
    components: [buildContentContainer(session.draft, false)],
    allowedMentions: { parse: [] },
  };

  try {
    if (session.edit) {
      const fetched = await fetchGuildMessage(guild, session.edit.channelId, session.edit.messageId);
      if (typeof fetched === "string") {
        await interaction.reply(utilityError("Message not found", fetched));
        return;
      }
      await fetched.message.edit(payload);
    } else {
      await channel.send(payload);
    }
  } catch {
    await interaction.reply(
      utilityError(
        session.edit ? "Could not edit Components V2" : "Could not publish Components V2",
        "Discord refused the message. Check my permissions and that image URLs still resolve.",
      ),
    );
    return;
  }

  clearSession(guild.id, interaction.user.id);
  const copy = session.edit
    ? `Rewrote the Components V2 message in ${formatChannel(guild, channel.id)}.`
    : `Posted the Components V2 message in ${formatChannel(guild, channel.id)}.`;
  await interaction.update(
    asMessageEdit(utilitySuccess(session.edit ? "Components V2 updated" : "Components V2 published", copy, false)),
  );

  await auditUtility(
    interaction,
    guild,
    session.edit ? "A Components V2 message was rewritten." : "A Components V2 message was published.",
    [
      `**Channel:** ${formatChannel(guild, channel.id)}`,
      session.edit ? `**Message:** \`${session.edit.messageId}\`` : `**Blocks:** ${session.draft.blocks.length}`,
    ],
  );
}
