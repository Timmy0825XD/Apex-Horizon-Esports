import { ContainerBuilder, MessageFlags, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import type { BanDuration } from "./durations.js";

export function userErrorMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
    allowedMentions: { parse: [] },
  };
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function userBanMessage(input: {
  userId: string;
  duration: BanDuration;
  expiresAt: Date | null;
  reason: string | null;
  actorId: string;
  thumbnailUrl?: string;
  note?: string;
}): InteractionReplyOptions {
  const who = formatUser(input.userId);
  const expiry = input.expiresAt
    ? `<t:${unixSeconds(input.expiresAt)}:F> (<t:${unixSeconds(input.expiresAt)}:R>)`
    : "*Does not expire*";
  const lines = [
    `${who} is banned for **${input.duration}**.`,
    `> **Duration:** **${input.duration}**`,
    `> **Expires:** ${expiry}`,
    `> **Reason:** ${input.reason ? input.reason : "*No reason provided*"}`,
  ];
  if (input.note) {
    lines.push(`*${input.note}*`);
  }

  const heading = `# ${emojis.banned} User banned`;
  const container = new ContainerBuilder().setAccentColor(embedColors.success);
  if (input.thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(heading, input.thumbnailUrl, lines.join("\n")));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(lines.join("\n")));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Triggered by ${formatUser(input.actorId)}`));

  return {
    components: [container],
    allowedMentions: { parse: [] },
  };
}

export function userUnbanMessage(input: {
  userId: string;
  actorId: string;
  thumbnailUrl?: string;
  hadDiscordBan: boolean;
}): InteractionReplyOptions {
  const who = formatUser(input.userId);
  const summary = input.hadDiscordBan
    ? `${who} can rejoin this server. Any pending expiry was cancelled.`
    : `${who} had no Discord ban left. I cancelled the pending expiry so it will not be reapplied.`;

  const heading = `# ${emojis.success} User unbanned`;
  const container = new ContainerBuilder().setAccentColor(embedColors.success);
  if (input.thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(heading, input.thumbnailUrl, summary));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(summary));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Triggered by ${formatUser(input.actorId)}`));

  return {
    components: [container],
    allowedMentions: { parse: [] },
  };
}
