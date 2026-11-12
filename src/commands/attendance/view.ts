import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  type EmbedBuilder,
  type MessageCreateOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors, errorEmbed } from "../../lib/embeds.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { slashMention } from "../../lib/register-slash.js";
import { attachedFile, divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord, scoreLine, stageLabel } from "../room/labels.js";
import { MAX_RECORDING_LINKS } from "./youtube.js";
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

type CardFace = Pick<CardMatch, "tournamentName" | "stage" | "leftName" | "rightName" | "team1Score" | "team2Score"> & {
  channelId: string | null;
};

function cardScore(input: CardFace): string {
  const ticket = input.channelId ? ` · ${formatChannel(null, input.channelId)}` : "";
  return [
    `### ${scoreLine(input.leftName, input.rightName, input.team1Score, input.team2Score)}`,
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}**${ticket}`,
  ].join("\n");
}

function v2Message(container: ContainerBuilder): MessageCreateOptions {
  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
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

/** Link buttons, 5 per row. `firstNumber` and `total` keep the numbering of the full list when only part of it is shown. */
function recordingRows(links: string[], firstNumber = 1, total?: number): ActionRowBuilder<ButtonBuilder>[] {
  const urls = links.map((link) => link.trim()).filter((link) => link.length > 0);
  const count = total ?? urls.length;
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let start = 0; start < urls.length; start += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        urls.slice(start, start + 5).map((url, offset) =>
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(url)
            .setLabel(count === 1 ? "Recording" : `Recording ${firstNumber + start + offset}`)
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

function linkCount(count: number): string {
  return `${count} ${count === 1 ? "link" : "links"}`;
}

export function linksAddedMessage(
  input: CardFace & {
    added: string[];
    total: number;
    actorId: string;
    at: Date;
  },
): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(cardHeading(`## ${emojis.success} Recording Links Added`, input.stage)),
      textBlock(cardScore(input)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`${emojis.link} **Added** \`${input.added.length}\` · **Total** \`${input.total}\` of ${MAX_RECORDING_LINKS}`),
    )
    .addActionRowComponents(...recordingRows(input.added, input.total - input.added.length + 1, input.total))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Added by ${formatUser(input.actorId)} · ${stamp(input.at)}`));
  return v2Message(container);
}

export function linksRemovedMessage(
  input: CardFace & {
    guildId: string;
    recorderId: string;
    removed: number;
    actorId: string;
    at: Date;
  },
): MessageCreateOptions {
  const lines = [
    `${emojis.link} **Removed** \`${input.removed}\` ${input.removed === 1 ? "link" : "links"}`,
    `${emojis.recorder} **Recorder** ${formatUser(input.recorderId)} can add them again with ${slashMention(input.guildId, "link add")}`,
  ];
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.error)
    .addTextDisplayComponents(
      textBlock(cardHeading(`## ${emojis.error} Recording Links Removed`, input.stage)),
      textBlock(cardScore(input)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(lines.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Removed by ${formatUser(input.actorId)} · ${stamp(input.at)}`));
  return v2Message(container);
}

export function noRecordingLinksMessage(input: CardFace): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(
      textBlock(cardHeading(`## ${emojis.info} No Recording Links`, input.stage)),
      textBlock(cardScore(input)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock("This attendance has no recording links, so nothing was removed."));
  return v2Message(container);
}

function relative(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

type EntryMatch = { group: string | null; round: number; player1Name: string; player2Name: string } | undefined;

function entryFace(match: EntryMatch, matchId: number): string {
  if (!match) {
    return `${emojis.vs} Match \`${matchId}\``;
  }
  const stage = stageLabel(match);
  const face = `${emojis.vs} **${escapeDiscord(match.player1Name)}** vs **${escapeDiscord(match.player2Name)}**`;
  return stage ? `${face} · *${stage}*` : face;
}

export function historyEntry(
  userId: string,
  row: { judgeId: string; recorderId: string; team1Score: number; team2Score: number; links: string[]; remark: string | null; createdAt: Date; challongeMatchId: number },
  match: EntryMatch,
): string {
  const role =
    row.judgeId === row.recorderId
      ? `${emojis.judge_recorder} Judge & Recorder`
      : userId === row.judgeId
        ? `${emojis.judge} Judge`
        : `${emojis.recorder} Recorder`;
  const links = hasRecordingLink(row.links)
    ? `${emojis.link} ${linkCount(row.links.filter((link) => link.trim()).length)}`
    : isDefaultWin(row.remark)
      ? "`DW` link not required"
      : `${emojis.alert} **Missing link**`;
  return [
    entryFace(match, row.challongeMatchId),
    `${role} · \`${row.team1Score} - ${row.team2Score}\` · ${links} · ${relative(row.createdAt)}`,
  ].join("\n");
}

export function historyMessage(input: {
  userId: string;
  avatarUrl: string | null;
  tournamentName: string;
  total: number;
  page: number;
  pages: number;
  lines: string[];
  disabled?: boolean;
}): MessageCreateOptions {
  const title = `## ${emojis.calendar} Attendance History`;
  const who = [
    formatUser(input.userId),
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · \`${input.total}\` ${input.total === 1 ? "record" : "records"}`,
  ].join("\n");
  const container = new ContainerBuilder().setAccentColor(embedColors.info);
  if (input.avatarUrl) {
    container.addSectionComponents(headingWithThumbnail(title, input.avatarUrl, who));
  } else {
    container.addTextDisplayComponents(textBlock(title), textBlock(who));
  }
  const body = input.lines.length > 0 ? input.lines.join("\n\n") : "*No attendance records for this member.*";
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(...textChunks(body).map((chunk) => textBlock(chunk)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# Page ${input.page + 1}/${input.pages} · ${input.total} ${input.total === 1 ? "record" : "records"} · newest first`),
    );
  if (input.pages > 1) {
    container.addActionRowComponents(iconPagerRow("att:hist", input.page, input.pages, input.disabled));
  }
  return v2Message(container);
}

export function missingEntry(
  index: number,
  row: { recorderId: string; createdAt: Date; challongeMatchId: number },
  match: EntryMatch,
  channelId: string | null,
): string {
  const ticket = channelId ? ` · ${formatChannel(null, channelId)}` : "";
  return [
    `**${index}.** ${entryFace(match, row.challongeMatchId)}`,
    `${emojis.recorder} ${formatUser(row.recorderId)} · marked ${relative(row.createdAt)}${ticket}`,
  ].join("\n");
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
  guildId: string;
  tournamentName: string;
  total: number;
  page: number;
  pages: number;
  lines: string[];
  recorderId?: string | null;
  disabled?: boolean;
}): MessageCreateOptions {
  const waiting = input.total === 1 ? "match waiting for a link" : "matches waiting for a link";
  const header = [
    `## ${emojis.alert} Missing Recording Links`,
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · \`${input.total}\` ${waiting}`,
  ];
  if (input.recorderId) {
    header.push(`${emojis.recorder} Only ${formatUser(input.recorderId)}`);
  }
  const body = input.lines.length > 0 ? input.lines.join("\n\n") : "*No matches are waiting on a recording link.*";
  const container = new ContainerBuilder()
    .setAccentColor(0xf39c12)
    .addTextDisplayComponents(textBlock(header.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(...textChunks(body).map((chunk) => textBlock(chunk)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        `-# Page ${input.page + 1}/${input.pages} · newest first · add them with ${slashMention(input.guildId, "link add")}`,
      ),
    );
  if (input.pages > 1) {
    container.addActionRowComponents(iconPagerRow("att:miss", input.page, input.pages, input.disabled));
  }
  return v2Message(container);
}

export function sheetMessage(input: {
  tournamentName: string;
  format: string;
  mode: PayMode;
  records: number;
  includeDw: boolean;
  judges: number;
  recorders: number;
  duals: number;
  totalGold: number;
  filename: string;
}): MessageCreateOptions {
  const summary = [
    `**Records** \`${input.records}\` · \`DW\` ${input.includeDw ? "included" : "excluded"}`,
    `${emojis.judge} **Judges** \`${input.judges}\` · ${emojis.recorder} **Recorders** \`${input.recorders}\` · ${emojis.judge_recorder} **Both Roles** \`${input.duals}\``,
    `${emojis.AC} **Estimated payroll** \`${formatArtCoin(input.totalGold)} AC\` · \`${input.totalGold} GOLD\``,
  ];
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(
        [
          `## ${emojis.stats} Attendance Workbook`,
          `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · \`${escapeDiscord(input.format)}\` · ${salaryType(input.mode)}`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(summary.join("\n")))
    .addFileComponents(attachedFile(input.filename))
    .addTextDisplayComponents(
      textBlock("-# Sheets: Attendance Records · Work Count · Salary Estimate · Tournament Info"),
    );
  return v2Message(container);
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
  // One attendance is a round; its matches are the two scores added up.
  const rounds = plural(work.matches, "round", "rounds");
  const done = mode === "per_game" ? `${rounds} · ${plural(work.games, "match", "matches")}` : rounds;
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
