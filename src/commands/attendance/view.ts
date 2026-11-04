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
import { escapeDiscord, matchLabel, scoreLine, stageLabel } from "../room/labels.js";
import {
  PAY_RATES,
  formatArtCoin,
  hasRecordingLink,
  isDefaultWin,
  type PayMode,
  type PersonSalary,
  type RoleWork,
} from "./payroll.js";

export { scoreLine, stageLabel };

type CardMatch = {
  tournamentName: string;
  channelId: string;
  stage: string | null;
  leftName: string;
  rightName: string;
  team1Score: number;
  team2Score: number;
  judgeId: string;
  recorderId: string;
};

function cardHeading(title: string, stage: string | null): string {
  return stage ? `${title}\n-# ${stage}` : title;
}

function cardScore(input: CardMatch): string {
  return [
    `### ${scoreLine(input.leftName, input.rightName, input.team1Score, input.team2Score)}`,
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · ${formatChannel(null, input.channelId)}`,
  ].join("\n");
}

function staffLines(judgeId: string, recorderId: string): string[] {
  if (judgeId === recorderId) {
    return [`${emojis.judge_recorder} **Judge & Recorder** ${formatUser(judgeId)}`];
  }
  return [`${emojis.judge} **Judge** ${formatUser(judgeId)}`, `${emojis.recorder} **Recorder** ${formatUser(recorderId)}`];
}

function stamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function recordingRows(links: string[]): ActionRowBuilder<ButtonBuilder>[] {
  const urls = links.map((link) => link.trim()).filter((link) => link.length > 0);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let start = 0; start < urls.length; start += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        urls.slice(start, start + 5).map((url, offset) =>
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(url)
            .setLabel(urls.length === 1 ? "Recording" : `Recording ${start + offset + 1}`)
            .setEmoji(customEmoji(emojis.link)),
        ),
      ),
    );
  }
  return rows;
}

export function markedMessage(
  input: CardMatch & {
    links: string[];
    remark: string | null;
    uploadedBy: string;
    markedAt: Date;
  },
): MessageCreateOptions {
  const details = staffLines(input.judgeId, input.recorderId);
  if (isDefaultWin(input.remark)) {
    details.push("**Remark** `DW` · *default win, no recording needed*");
  }

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(cardHeading(`## ${emojis.success} Attendance Marked`, input.stage)),
      textBlock(cardScore(input)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(details.join("\n")));
  if (hasRecordingLink(input.links)) {
    container.addActionRowComponents(...recordingRows(input.links));
  }
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Uploaded by ${formatUser(input.uploadedBy)} · ${stamp(input.markedAt)}`));

  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

export function deletedMessage(
  input: CardMatch & {
    reason: string | null;
    deletedBy: string;
    deletedAt: Date;
  },
): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.error)
    .addTextDisplayComponents(
      textBlock(cardHeading(`## ${emojis.error} Attendance Deleted`, input.stage)),
      textBlock(cardScore(input)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(staffLines(input.judgeId, input.recorderId).join("\n")));
  if (input.reason) {
    container.addTextDisplayComponents(textBlock(`**Reason**\n> ${escapeDiscord(input.reason).replace(/\n/g, "\n> ")}`));
  }
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Deleted by ${formatUser(input.deletedBy)} · ${stamp(input.deletedAt)}`));

  return {
    components: [container],
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

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function workLine(emoji: string, label: string, work: RoleWork, mode: PayMode, unit: SalaryUnit): string {
  const matches = plural(work.matches, "match", "matches");
  const done = mode === "per_game" ? `${matches} · ${plural(work.games, "game", "games")}` : matches;
  return `${emoji} **${label}** \`${amount(work.gold, unit)}\` · *${done}*`;
}

export function salaryMessage(input: {
  userId: string;
  avatarUrl: string | null;
  tournamentName: string;
  mode: PayMode;
  salary: PersonSalary;
  unit: SalaryUnit;
  disabled?: boolean;
}): MessageCreateOptions {
  const title = `## ${emojis.stats} Salary Report`;
  const who = [
    formatUser(input.userId),
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · ${salaryType(input.mode)}`,
  ].join("\n");
  const work = [
    workLine(emojis.judge, "Judge", input.salary.judge, input.mode, input.unit),
    workLine(emojis.recorder, "Recorder", input.salary.recorder, input.mode, input.unit),
    workLine(emojis.judge_recorder, "Both Roles", input.salary.dual, input.mode, input.unit),
  ].join("\n");
  const currency = input.unit === "gold" ? emojis.gold : emojis.AC;
  const unitName = input.unit === "gold" ? "GOLD" : "AC";
  const rates = PAY_RATES[input.mode];
  const total = [
    `## ${currency} Total \`${amount(input.salary.total, input.unit)} ${unitName}\``,
    `-# ${salaryType(input.mode)} · Judge ${amount(rates.judge, input.unit)} · Recorder ${amount(rates.recorder, input.unit)} · Both Roles ${amount(rates.dual, input.unit)} ${unitName}`,
  ].join("\n");

  const container = new ContainerBuilder().setAccentColor(0xe8ff00);
  if (input.avatarUrl) {
    container.addSectionComponents(headingWithThumbnail(title, input.avatarUrl, who));
  } else {
    container.addTextDisplayComponents(textBlock(title), textBlock(who));
  }
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(work))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(total))
    .addActionRowComponents(salaryRow(input.unit, input.disabled));

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
