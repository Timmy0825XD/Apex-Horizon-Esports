import { ContainerBuilder, MessageFlags, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
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

function footer(verb: string, actorId: string): string {
  return `-# ${verb} by ${formatUser(actorId)} · <t:${unixSeconds(new Date())}:F>`;
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
  const heading = `## ${emojis.banned} User Banned\n${formatUser(input.userId)} · \`${input.userId}\``;
  const timing = input.expiresAt
    ? [
        `${emojis.uptime} **Duration** ${input.duration} · expires <t:${unixSeconds(input.expiresAt)}:R>`,
        `${emojis.calendar} **Until** <t:${unixSeconds(input.expiresAt)}:F>`,
      ]
    : [`${emojis.uptime} **Duration** ${input.duration} · does not expire`];
  const reason = input.reason
    ? `**Reason**\n> ${escapeDiscord(input.reason).replace(/\n/g, "\n> ")}`
    : "**Reason** *No reason given*";

  const container = new ContainerBuilder().setAccentColor(embedColors.error);
  if (input.thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(heading, input.thumbnailUrl, timing.join("\n")));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(timing.join("\n")));
  }
  container.addTextDisplayComponents(textBlock(reason));
  if (input.note) {
    container.addTextDisplayComponents(textBlock(`${emojis.alert} *${input.note}*`));
  }

  container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(footer("Banned", input.actorId)));

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
  const heading = `## ${emojis.success} User Unbanned\n${formatUser(input.userId)} · \`${input.userId}\``;
  const summary = input.hadDiscordBan
    ? `${emojis.members} Can rejoin this server. The pending expiry was cancelled.`
    : `${emojis.members} Had no Discord ban left. The pending expiry was cancelled so it will not be reapplied.`;

  const container = new ContainerBuilder().setAccentColor(embedColors.success);
  if (input.thumbnailUrl) {
    container.addSectionComponents(headingWithThumbnail(heading, input.thumbnailUrl, summary));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(summary));
  }

  container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(footer("Unbanned", input.actorId)));

  return {
    components: [container],
    allowedMentions: { parse: [] },
  };
}
