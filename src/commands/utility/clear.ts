import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildBasedChannel,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { formatCategory, formatChannel } from "../../lib/formatters.js";
import { botHasChannelPermission, canClearCategory, canManageMessages } from "./access.js";
import { auditUtility } from "./audit.js";
import { wait } from "./channels.js";
import { deferUtility, respondUtility, asMessageEdit, utilityError, utilityInfo, utilitySuccess } from "./view.js";

function confirmRow(userId: string, categoryId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`utility:cat:ok:${userId}:${categoryId}`)
      .setLabel("Confirm delete")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(customEmoji(emojis.error)),
    new ButtonBuilder()
      .setCustomId(`utility:cat:no:${userId}:${categoryId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

function categoryChildren(guild: Guild, categoryId: string): GuildBasedChannel[] {
  return [...guild.channels.cache.values()].filter((channel) => channel.parentId === categoryId);
}

export async function handleClear(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const number = interaction.options.getInteger("number");
  const days = interaction.options.getInteger("days");
  if ((number == null && days == null) || (number != null && days != null)) {
    await respondUtility(
      interaction,
      utilityError("Choose one filter", "Pass **number** (1–1000) or **days** (1–14), not both."),
    );
    return;
  }

  if (!canManageMessages(interaction)) {
    await respondUtility(
      interaction,
      utilityError("Manage Messages required", "You need **Manage Messages** to purge this channel."),
    );
    return;
  }

  const channel = interaction.channel;
  if (!channel || !("bulkDelete" in channel) || channel.isDMBased()) {
    await respondUtility(
      interaction,
      utilityError("Channel cannot be purged", "Run this in a server text channel I can manage."),
    );
    return;
  }

  if (!botHasChannelPermission(channel, PermissionFlagsBits.ManageMessages)) {
    await respondUtility(
      interaction,
      utilityError("I cannot manage messages", "I need **Manage Messages** in this channel to purge it."),
    );
    return;
  }

  await deferUtility(interaction, true);

  const afterDate = days != null ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
  const max = number ?? 1000;
  const collected: Array<{ id: string; createdTimestamp: number; bulkDeletable: boolean; deletable: boolean }> = [];
  let before: string | undefined;

  while (collected.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) {
      break;
    }
    const sorted = [...batch.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    let reachedCutoff = false;
    for (const message of sorted) {
      if (afterDate && message.createdTimestamp < afterDate.getTime()) {
        reachedCutoff = true;
        break;
      }
      collected.push(message);
      if (collected.length >= max) {
        break;
      }
    }
    before = sorted[sorted.length - 1]?.id;
    if (reachedCutoff || batch.size < 100 || !before) {
      break;
    }
  }

  const young = collected.filter((message) => message.bulkDeletable);
  const skipped = collected.length - young.length;
  let deleted = 0;

  for (let i = 0; i < young.length; i += 100) {
    const chunk = young.slice(i, i + 100);
    if (chunk.length === 1) {
      const target = await channel.messages.fetch(chunk[0]!.id).catch(() => null);
      if (target?.deletable) {
        await target.delete().catch(() => undefined);
        deleted += 1;
      }
    } else {
      const result = await channel.bulkDelete(
        chunk.map((message) => message.id),
        true,
      );
      deleted += result.size;
    }
    if (i + 100 < young.length) {
      await wait(1100);
    }
  }

  const skipNote =
    skipped > 0
      ? `\n*${skipped} message${skipped === 1 ? "" : "s"} older than 14 days were left in place.*`
      : "";

  await respondUtility(
    interaction,
    utilitySuccess(
      "Channel purged",
      `Deleted **${deleted}** message${deleted === 1 ? "" : "s"} in ${formatChannel(guild, channel.id)}.${skipNote}`,
    ),
  );

  if (deleted > 0) {
    await auditUtility(interaction, guild, "Messages were purged from a channel.", [
      `**Channel:** ${formatChannel(guild, channel.id)}`,
      `**Deleted:** ${deleted}`,
      number != null ? `**Number requested:** ${number}` : `**Days requested:** ${days}`,
    ]);
  }
}

export async function handleClearCategory(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!canClearCategory(interaction)) {
    await respondUtility(
      interaction,
      utilityError(
        "Administrator required",
        "Only a Discord **Administrator** can delete every channel under a category.",
      ),
    );
    return;
  }

  const selected = interaction.options.getChannel("category", true);
  if (selected.type !== ChannelType.GuildCategory) {
    await respondUtility(
      interaction,
      utilityError("Category required", "Pick a **category**, not a regular channel."),
    );
    return;
  }

  await guild.channels.fetch().catch(() => undefined);
  const category = guild.channels.cache.get(selected.id);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await respondUtility(interaction, utilityError("Category missing", "I could not load that category."));
    return;
  }

  const children = categoryChildren(guild, category.id);
  if (children.length === 0) {
    await respondUtility(
      interaction,
      utilityInfo(
        "Nothing to delete",
        `${formatCategory(guild, category.id)} has no child channels.`,
      ),
    );
    return;
  }

  const listing = children
    .slice(0, 15)
    .map((child) => formatChannel(guild, child.id))
    .join("\n");
  const extra = children.length > 15 ? `\n*…and **${children.length - 15}** more.*` : "";

  const warning = utilityError(
    "Delete every channel in this category?",
    `This permanently deletes **${children.length}** channel${children.length === 1 ? "" : "s"} under ${formatCategory(guild, category.id)}. The category itself stays.\n\n${listing}${extra}`,
  );
  await interaction.reply({
    ...warning,
    components: [...(warning.components ?? []), confirmRow(interaction.user.id, category.id)],
  });
}

export async function handleClearCategoryButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[2];
  const userId = parts[3];
  const categoryId = parts[4];
  const guild = interaction.guild;

  if (!guild || !userId || !categoryId) {
    return;
  }

  if (interaction.user.id !== userId) {
    await interaction.reply(utilityError("Not your confirmation", "Only the person who ran the command can confirm this."));
    return;
  }

  if (action === "no") {
    await interaction.update(
      asMessageEdit(utilityInfo("Category wipe cancelled", `No channels under ${formatCategory(guild, categoryId)} were deleted.`)),
    );
    return;
  }

  if (!canClearCategory(interaction)) {
    await interaction.reply(
      utilityError("Administrator required", "Only a Discord **Administrator** can confirm this wipe."),
    );
    return;
  }

  await interaction.deferUpdate();
  await guild.channels.fetch().catch(() => undefined);

  const category = guild.channels.cache.get(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await interaction.editReply(asMessageEdit(utilityError("Category missing", "That category is gone, so nothing was deleted.", false)));
    return;
  }

  const children = categoryChildren(guild, category.id);
  let deleted = 0;
  let failed = 0;
  for (const child of children) {
    try {
      await child.delete(`Category wipe by ${interaction.user.id}`);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  const failNote = failed > 0 ? `\n**${failed}** could not be deleted.` : "";
  await interaction.editReply(
    asMessageEdit(
      utilitySuccess(
        "Category cleared",
        `Deleted **${deleted}** channel${deleted === 1 ? "" : "s"} under ${formatCategory(guild, category.id)}. The category itself was kept.${failNote}`,
        false,
      ),
    ),
  );

  if (deleted > 0) {
    await auditUtility(interaction, guild, "Every child channel under a category was deleted.", [
      `**Category:** ${formatCategory(guild, category.id)}`,
      `**Deleted:** ${deleted}`,
      `**Failed:** ${failed}`,
    ]);
  }
}
