import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  type MessageCreateOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors, errorEmbed } from "../../lib/embeds.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord, matchLabel } from "../room/labels.js";
import { formatArtCoin, hasRecordingLink, isDefaultWin, type PayMode, type PersonSalary } from "./payroll.js";

export function scoreLine(leftName: string, rightName: string, team1: number, team2: number): string {
  const left = `**${escapeDiscord(leftName)}**`;
  const right = `**${escapeDiscord(rightName)}**`;
  const leftShown = team1 > team2 ? `${emojis.winner} ${left}` : left;
  const rightShown = team2 > team1 ? `${emojis.winner} ${right}` : right;
  return `${leftShown} \`${team1}\` vs \`${team2}\` ${rightShown}`;
}

export function markedMessage(input: {
  tournamentName: string;
  channelId: string;
  judgeId: string;
  recorderId: string;
  team1Score: number;
  team2Score: number;
  leftName: string;
  rightName: string;
  links: string[];
  remark: string | null;
  uploadedBy: string;
  markedAt: Date;
}): MessageCreateOptions {
  const intro = [
    scoreLine(input.leftName, input.rightName, input.team1Score, input.team2Score),
    `${emojis.torneo} **Tournament:** ${escapeDiscord(input.tournamentName)}`,
  ].join("\n");
  const details = [
    `${emojis.judge} **Judge**\n${formatUser(input.judgeId)}`,
    `${emojis.recorder} **Recorder**\n${formatUser(input.recorderId)}`,
    `${emojis.textChannel} **Channel**\n${formatChannel(null, input.channelId)}`,
  ];
  if (hasRecordingLink(input.links)) {
    details.push(`**Recording Link**\n${input.links.map((url) => `[Link](${url})`).join("\n")}`);
  }
  if (isDefaultWin(input.remark)) {
    details.push("**Remark**\n`DW`");
  }

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.success} Attendance Marked Successfully`),
      textBlock(intro),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(details.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# Uploaded by ${formatUser(input.uploadedBy)} · <t:${Math.floor(input.markedAt.getTime() / 1000)}:F>`),
    );

  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export function deletedMessage(input: {
  tournamentName: string;
  channelId: string;
  reason: string | null;
}): MessageCreateOptions {
  const lines = [
    `${emojis.torneo} **Tournament:** ${escapeDiscord(input.tournamentName)}`,
    `${emojis.textChannel} **Channel:** ${formatChannel(null, input.channelId)}`,
  ];
  if (input.reason) {
    lines.push(`**Reason:** ${escapeDiscord(input.reason)}`);
  }
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} Attendance Deleted`), textBlock(lines.join("\n"))),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export function linksRemovedMessage(input: {
  tournamentName: string;
  leftName: string;
  rightName: string;
  removed: number;
}): MessageCreateOptions {
  const noun = input.removed === 1 ? "link" : "links";
  const lines = [
    `${emojis.link} **Removed:** \`${input.removed}\` ${noun}`,
    `${emojis.torneo} **Tournament:** ${escapeDiscord(input.tournamentName)}`,
    `${emojis.vs} **Match:** ${escapeDiscord(input.leftName)} vs ${escapeDiscord(input.rightName)}`,
  ];
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} Recording Links Removed`), textBlock(lines.join("\n"))),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export function noRecordingLinksMessage(input: {
  tournamentName: string;
  leftName: string;
  rightName: string;
}): MessageCreateOptions {
  const lines = [
    `${emojis.torneo} **Tournament:** ${escapeDiscord(input.tournamentName)}`,
    `${emojis.vs} **Match:** ${escapeDiscord(input.leftName)} vs ${escapeDiscord(input.rightName)}`,
    "There are no recording links on this attendance.",
  ];
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(textBlock(`# ${emojis.info} No Recording Links`), textBlock(lines.join("\n"))),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export function matchSummary(match: { group: string | null; round: number; player1Name: string; player2Name: string } | null, matchId: number): string {
  if (!match) {
    return `Match \`${matchId}\``;
  }
  return matchLabel({
    group: match.group,
    round: match.round,
    leftName: match.player1Name,
    rightName: match.player2Name,
  });
}

export function roleLabel(userId: string, judgeId: string, recorderId: string): string {
  if (judgeId === recorderId) {
    return "Judge & Recorder";
  }
  if (userId === judgeId) {
    return "Judge";
  }
  return "Recorder";
}

export function historyEmbed(input: {
  tournamentName: string;
  page: number;
  pages: number;
  lines: string[];
}): EmbedBuilder {
  const body = input.lines.length > 0 ? input.lines.join("\n\n") : "*No attendance records on this page.*";
  return new EmbedBuilder()
    .setColor(embedColors.info)
    .setTitle(`${emojis.calendar} Attendance — ${input.tournamentName}`.slice(0, 256))
    .setDescription(body.slice(0, 4096))
    .setFooter({ text: `Page ${input.page + 1}/${input.pages}` });
}

function textChunks(value: string, size = 3900): string[] {
  if (value.length <= size) {
    return [value];
  }
  const chunks: string[] = [];
  let rest = value;
  while (rest.length > size) {
    const cut = rest.lastIndexOf("\n\n", size);
    const at = cut > 200 ? cut : size;
    chunks.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n+/, "");
  }
  if (rest.length > 0) {
    chunks.push(rest);
  }
  return chunks;
}

export function missingMessage(input: {
  tournamentName: string;
  total: number;
  page: number;
  pages: number;
  lines: string[];
  userLine?: string | null;
  disabled?: boolean;
}): MessageCreateOptions {
  const attention = input.total === 1 ? "match needs" : "matches need";
  const header = [
    `${emojis.torneo} **Tournament:** **${escapeDiscord(input.tournamentName)}**`,
    input.userLine,
    `${emojis.link} **Missing Links:** **${input.total}** ${attention} attention`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const body = input.lines.length > 0 ? input.lines.join("\n\n") : "*No matches are waiting on a recording link.*";
  const container = new ContainerBuilder()
    .setAccentColor(0xf39c12)
    .addTextDisplayComponents(textBlock(`# ${emojis.alert} Missing Recording Links`), textBlock(header))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(...textChunks(body).map((chunk) => textBlock(chunk)))
    .addTextDisplayComponents(textBlock(`-# Page ${input.page + 1}/${input.pages} · ${input.total} total missing`));
  if (input.pages > 1) {
    container.addActionRowComponents(iconPagerRow("att:miss", input.page, input.pages, input.disabled));
  }
  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export type SalaryUnit = "ac" | "gold";

function amount(gold: number, unit: SalaryUnit): string {
  return unit === "gold" ? String(gold) : formatArtCoin(gold);
}

function salaryType(mode: PayMode): string {
  return mode === "per_game" ? "Per game" : "Per match";
}

export function salaryMessage(input: {
  username: string;
  avatarUrl: string | null;
  tournamentName: string;
  mode: PayMode;
  salary: PersonSalary;
  unit: SalaryUnit;
  disabled?: boolean;
}): MessageCreateOptions {
  const title = `# ${emojis.stats} **${escapeDiscord(input.username)}**`;
  const lines = [
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · ${salaryType(input.mode)}`,
    "",
    `${emojis.judge} **Judge**  \`${amount(input.salary.judge, input.unit)}\``,
    `${emojis.recorder} **Recorder**  \`${amount(input.salary.recorder, input.unit)}\``,
    `${emojis.judge_recorder}**Both Roles**  \`${amount(input.salary.dual, input.unit)}\``,
  ].join("\n");
  const currency = input.unit === "gold" ? emojis.gold : emojis.AC;
  const container = new ContainerBuilder()
    .setAccentColor(0xe8ff00)
    .addActionRowComponents(salaryRow(input.unit, input.disabled))
    .addSeparatorComponents(divider());
  if (input.avatarUrl) {
    container.addSectionComponents(headingWithThumbnail(title, input.avatarUrl, lines));
  } else {
    container.addTextDisplayComponents(textBlock(title), textBlock(lines));
  }
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`${currency} **Total**  \`${amount(input.salary.total, input.unit)}\``));

  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export function iconPagerRow(prefix: string, page: number, pages: number, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back))
      .setDisabled(disabled || page <= 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:stay`)
      .setLabel(`${page + 1}/${pages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next))
      .setDisabled(disabled || page >= pages - 1),
  );
}

export function pagerRow(prefix: string, page: number, pages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back))
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:stay`)
      .setLabel(`${page + 1}/${pages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next))
      .setDisabled(page >= pages - 1),
  );
}

export function salaryRow(unit: SalaryUnit, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("att:unit:gold")
      .setLabel("GOLD")
      .setStyle(unit === "gold" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.gold))
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("att:unit:ac")
      .setLabel("AC")
      .setStyle(unit === "ac" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.AC))
      .setDisabled(disabled),
  );
}

export function attendanceError(title: string, description: string): EmbedBuilder {
  return errorEmbed(title, description);
}

export function eventsLinksText(input: {
  leftName: string;
  rightName: string;
  team1Score: number;
  team2Score: number;
  links: string[];
}): string {
  return [
    `**Match:** ${escapeDiscord(input.leftName)} vs ${escapeDiscord(input.rightName)}`,
    `**Score:** ${scoreLine(input.leftName, input.rightName, input.team1Score, input.team2Score)}`,
    "**Links:**",
    ...input.links.map((url) => `- [Link](${url})`),
  ].join("\n");
}
