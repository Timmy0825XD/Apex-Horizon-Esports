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
import { embedColors } from "../../lib/embeds.js";
import { formatCategory, formatChannel, formatUser } from "../../lib/formatters.js";
import { actorMatches } from "../../lib/command-access.js";
import { botHasChannelPermission } from "./access.js";
import { auditUtility } from "./audit.js";
import { wait } from "./channels.js";
import { actorFooter, asMessageEdit, deferUtility, respondUtility, utilityCard, utilityError, utilityInfo } from "./view.js";

function confirmRow(userId: string, categoryId: string, count: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`utility:cat:ok:${userId}:${categoryId}`)
      .setLabel(`Delete ${count} ${count === 1 ? "channel" : "channels"}`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji(customEmoji(emojis.error)),
    new ButtonBuilder()
      .setCustomId(`utility:cat:no:${userId}:${categoryId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.info)),
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

  if (!(await actorMatches(interaction, { admin: true }))) {
    await respondUtility(interaction, utilityError("Admin required", "You need **Admin** to purge this channel."));
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

  const filter = number != null ? `last ${number} ${number === 1 ? "message" : "messages"}` : `last ${days} ${days === 1 ? "day" : "days"}`;
  const counts = [`**Deleted** \`${deleted}\``];
  if (skipped > 0) {
    counts.push(`**Left in place** \`${skipped}\` *(older than 14 days, Discord will not bulk-delete them)*`);
  }

  await respondUtility(
    interaction,
    utilityCard({
      color: embedColors.error,
      heading: `## ${emojis.error} Channel Purged\n${formatChannel(guild, channel.id)} · ${filter}`,
      blocks: [counts.join(" · ")],
      footer: actorFooter("Purged", interaction.user.id),
      ephemeral: true,
    }),
  );

  if (deleted > 0) {
    await auditUtility(interaction, guild, {
      action: "deleted",
      title: "Channel purged",
      summary: `\`${deleted}\` ${deleted === 1 ? "message was" : "messages were"} deleted from ${formatChannel(guild, channel.id)}.`,
      groups: [{ lines: [number != null ? `**Number requested** \`${number}\`` : `**Days requested** \`${days}\``] }],
    });
  }
}

export async function handleClearCategory(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  if (!(await actorMatches(interaction, { admin: true }))) {
    await respondUtility(
      interaction,
      utilityError("Admin required", "You need **Admin** to delete every channel under a category."),
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
    .join(" ");
  const extra = children.length > 15 ? ` *and **${children.length - 15}** more*` : "";
  const count = children.length;

  await interaction.reply(
    utilityCard({
      color: 0xe67e22,
      heading: `## ${emojis.alert} Delete Every Channel in This Category?\n${formatCategory(guild, category.id)} · \`${count}\` ${count === 1 ? "channel" : "channels"} · the category itself stays`,
      blocks: [`${listing}${extra}`, `-# This cannot be undone. Only ${formatUser(interaction.user.id)} can use these buttons.`],
      rows: [confirmRow(interaction.user.id, category.id, count)],
      ephemeral: true,
    }),
  );
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
      asMessageEdit(
        utilityCard({
          color: embedColors.info,
          heading: `## ${emojis.info} Category Wipe Cancelled\nNo channels under ${formatCategory(guild, categoryId)} were deleted.`,
          footer: actorFooter("Cancelled", interaction.user.id),
          ephemeral: true,
        }),
      ),
    );
    return;
  }

  if (!(await actorMatches(interaction, { admin: true }))) {
    await interaction.reply(utilityError("Admin required", "You need **Admin** to confirm this wipe."));
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

  await interaction.editReply(
    asMessageEdit(
      utilityCard({
        color: embedColors.error,
        heading: `## ${emojis.error} Category Cleared\n${formatCategory(guild, category.id)} · the category was kept`,
        blocks: [`**Deleted** \`${deleted}\` · **Failed** \`${failed}\``],
        footer: actorFooter("Cleared", interaction.user.id),
        ephemeral: false,
      }),
    ),
  );

  if (deleted > 0) {
    await auditUtility(interaction, guild, {
      action: "deleted",
      title: "Category wiped",
      summary: `Every channel under ${formatCategory(guild, category.id)} was deleted.`,
      groups: [{ lines: [`\`${deleted}\` deleted`, `\`${failed}\` failed`], inline: true }],
    });
  }
}
