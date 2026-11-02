import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import type { Schedule } from "@prisma/client";
import { emojis, numberEmojis } from "../../emojis.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { actorMatches } from "../../lib/command-access.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { scheduleStatus, type ScheduleStatus } from "./show.js";
import { slashMention } from "../../lib/register-slash.js";

const PAGE_SIZE = 5;
const OPEN_COLOR = 0xf1c40f;
const FILTERS = ["any", "all", "missing_judge", "missing_recorder"] as const;

type OpenFilter = (typeof FILTERS)[number];
type Gap = "both" | "judge" | "recorder";

type OpenRow = {
  schedule: Schedule;
  left: string;
  right: string;
  tournamentName: string;
  status: ScheduleStatus;
  gap: Gap;
};

const FILTER_LABEL: Record<OpenFilter, string> = {
  any: "Either seat",
  all: "Both empty",
  missing_judge: "No judge",
  missing_recorder: "No recorder",
};

const GAP_LABEL: Record<Gap, string> = {
  both: "BOTH SEATS OPEN",
  judge: "JUDGE OPEN",
  recorder: "RECORDER OPEN",
};

const GAP_EMOJI: Record<Gap, string> = {
  both: emojis.judge_recorder,
  judge: emojis.judge,
  recorder: emojis.recorder,
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  pending: "PENDING",
  completed: "COMPLETED",
  overdue: "RESULT PENDING",
};

function isOpenFilter(value: string): value is OpenFilter {
  return (FILTERS as readonly string[]).includes(value);
}

function parseFilter(value: string | null): OpenFilter {
  return value && isOpenFilter(value) ? value : "any";
}

function gapOf(schedule: { judgeId: string | null; recorderId: string | null }): Gap | null {
  const missingJudge = !schedule.judgeId;
  const missingRecorder = !schedule.recorderId;
  if (missingJudge && missingRecorder) {
    return "both";
  }
  if (missingJudge) {
    return "judge";
  }
  if (missingRecorder) {
    return "recorder";
  }
  return null;
}

function matchesFilter(gap: Gap, filter: OpenFilter): boolean {
  if (filter === "all") {
    return gap === "both";
  }
  if (filter === "missing_judge") {
    return gap === "both" || gap === "judge";
  }
  if (filter === "missing_recorder") {
    return gap === "both" || gap === "recorder";
  }
  return true;
}

function listStamp(when: Date): string {
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const day = String(when.getUTCDate()).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${when.getUTCFullYear()}-${month}-${day} ${hour}:${minute} UTC`;
}

function seatText(seat: "judge" | "recorder", userId: string | null): string {
  const emoji = seat === "judge" ? emojis.judge : emojis.recorder;
  const label = seat === "judge" ? "Judge" : "Recorder";
  return userId ? `${emoji} **${label}:** ${formatUser(userId)}` : `${emoji} **${label}:** *Open*`;
}

function openCustomId(page: number, filter: OpenFilter): string {
  return `schedule:open:${page}:${filter}`;
}

function parseOpenCustomId(customId: string): { page: number; filter: OpenFilter } | null {
  const parts = customId.split(":");
  if (parts.length !== 4 || parts[0] !== "schedule" || parts[1] !== "open") {
    return null;
  }
  const page = Number(parts[2]);
  const filter = parts[3] ?? "";
  if (!Number.isInteger(page) || page < 0 || page > 500 || !isOpenFilter(filter)) {
    return null;
  }
  return { page, filter };
}

function payload(container: ContainerBuilder): InteractionReplyOptions {
  return { components: [container], flags: v2Flags, allowedMentions: { parse: [] } };
}

function emptyBody(filter: OpenFilter): string {
  if (filter === "all") {
    return "No match that is still open is missing both seats.";
  }
  if (filter === "missing_judge") {
    return "No match that is still open is missing a judge.";
  }
  if (filter === "missing_recorder") {
    return "No match that is still open is missing a recorder.";
  }
  return "No match that is still open is missing a judge or a recorder.";
}

function itemBlock(guild: Guild, index: number, row: OpenRow): string {
  const unix = Math.floor(row.schedule.scheduledAt.getTime() / 1000);
  const badge = numberEmojis[index] ?? `**${index + 1}.**`;
  return [
    `${badge} **${escapeDiscord(row.left)} vs ${escapeDiscord(row.right)}**`,
    `<t:${unix}:R> (\`${listStamp(row.schedule.scheduledAt)}\`) · ${STATUS_LABEL[row.status]}`,
    `${emojis.torneo} ${escapeDiscord(row.tournamentName)} · ${formatChannel(guild, row.schedule.channelId)} · ${emojis.id} \`${row.schedule.challongeMatchId}\``,
    seatText("judge", row.schedule.judgeId),
    seatText("recorder", row.schedule.recorderId),
  ].join("\n");
}

function listBody(guild: Guild, rows: OpenRow[], filter: OpenFilter): string {
  const parts: string[] = [];
  let previous: Gap | null = null;
  rows.forEach((row, index) => {
    if (filter === "any" && row.gap !== previous) {
      parts.push(`## ${GAP_EMOJI[row.gap]} ${GAP_LABEL[row.gap]}`);
      previous = row.gap;
    }
    parts.push(itemBlock(guild, index, row));
  });
  return parts.join("\n\n");
}

function pager(page: number, pages: number, filter: OpenFilter): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(openCustomId(Math.max(page - 1, 0), filter))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back))
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("schedule:open:stay")
      .setLabel(`${page + 1}/${pages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(openCustomId(page + 1, filter))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next))
      .setDisabled(page >= pages - 1),
  );
}

async function loadOpen(guildId: string, filter: OpenFilter): Promise<OpenRow[]> {
  const schedules = await prisma.schedule.findMany({ where: { guildId }, orderBy: { scheduledAt: "asc" } });
  if (schedules.length === 0) {
    return [];
  }
  const tournamentIds = [...new Set(schedules.map((row) => row.tournamentId))];
  const channelIds = [...new Set(schedules.map((row) => row.channelId))];
  const [tournaments, matches, rooms] = await Promise.all([
    prisma.tournament.findMany({ where: { id: { in: tournamentIds }, guildId }, select: { id: true, name: true } }),
    prisma.match.findMany({ where: { tournamentId: { in: tournamentIds } } }),
    prisma.room.findMany({ where: { channelId: { in: channelIds } }, select: { channelId: true, status: true } }),
  ]);
  const tournamentById = new Map(tournaments.map((row) => [row.id, row]));
  const matchByKey = new Map(matches.map((row) => [`${row.tournamentId}:${row.challongeMatchId}`, row]));
  const closedChannels = new Set(rooms.filter((room) => room.status === "closed").map((room) => room.channelId));
  const now = Date.now();
  const rows: OpenRow[] = [];
  for (const schedule of schedules) {
    if (schedule.results || closedChannels.has(schedule.channelId)) {
      continue;
    }
    const tournament = tournamentById.get(schedule.tournamentId);
    const match = matchByKey.get(`${schedule.tournamentId}:${schedule.challongeMatchId}`);
    const gap = gapOf(schedule);
    if (!tournament || !match || !gap || !matchesFilter(gap, filter)) {
      continue;
    }
    rows.push({
      schedule,
      left: match.player1Name,
      right: match.player2Name,
      tournamentName: tournament.name,
      status: scheduleStatus(schedule, now),
      gap,
    });
  }
  const rank: Record<Gap, number> = { both: 0, judge: 1, recorder: 2 };
  rows.sort((left, right) => rank[left.gap] - rank[right.gap] || left.schedule.scheduledAt.getTime() - right.schedule.scheduledAt.getTime());
  return rows;
}

function listMessage(guild: Guild, filter: OpenFilter, rows: OpenRow[], page: number): InteractionReplyOptions {
  if (rows.length === 0) {
    return payload(
      new ContainerBuilder()
        .setAccentColor(OPEN_COLOR)
        .addTextDisplayComponents(textBlock(`# ${emojis.judge_recorder} No open seats`), textBlock(emptyBody(filter))),
    );
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const both = rows.filter((row) => row.gap === "both").length;
  const judges = rows.filter((row) => row.gap === "judge").length;
  const recorders = rows.filter((row) => row.gap === "recorder").length;
  const counts = [
    both > 0 ? `${emojis.judge_recorder} **Both:** \`${both}\`` : null,
    judges > 0 ? `${emojis.judge} **Judge:** \`${judges}\`` : null,
    recorders > 0 ? `${emojis.recorder} **Recorder:** \`${recorders}\`` : null,
  ].filter((line): line is string => Boolean(line));
  const header = [
    `${emojis.calendar} **Page:** \`${safePage + 1}/${pages}\``,
    `${emojis.stats} **Open schedules:** \`${rows.length}\``,
    `${emojis.info} **Filter:** ${FILTER_LABEL[filter]}`,
    ...counts,
  ];
  const container = new ContainerBuilder()
    .setAccentColor(OPEN_COLOR)
    .addTextDisplayComponents(textBlock(`# ${emojis.judge_recorder} Open seats`), textBlock(header.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(listBody(guild, slice, filter)));
  if (pages > 1) {
    container.addSeparatorComponents(divider()).addActionRowComponents(pager(safePage, pages, filter));
  }
  return payload(container);
}

async function listPayload(guild: Guild, filter: OpenFilter, page: number): Promise<InteractionReplyOptions> {
  return listMessage(guild, filter, await loadOpen(guild.id, filter), page);
}

export async function runUnassigned(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true }))) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "error",
        "Schedule access required",
        "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to list open seats.",
      ),
    );
    return;
  }
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
  await replySchedule(interaction, await listPayload(guild, parseFilter(interaction.options.getString("filter")), 0));
}

export async function handleOpenButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === "schedule:open:stay") {
    await interaction.deferUpdate();
    return;
  }
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  if (!isAllowedGuild(guild.id)) {
    await interaction.reply(scheduleNotice("error", "Server not allowed", "This server is not authorized to use this bot."));
    return;
  }
  const parsed = parseOpenCustomId(interaction.customId);
  if (!parsed) {
    await interaction.reply(scheduleNotice("error", "Page expired", `Run ${slashMention(interaction.guildId, "schedule unassigned")} again to open a fresh list.`)).catch(() => undefined);
    return;
  }
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true }))) {
    await interaction.reply(
      scheduleNotice(
        "error",
        "Schedule access required",
        "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to turn the open-seat pages.",
      ),
    );
    return;
  }
  await interaction.deferUpdate();
  try {
    const next = await listPayload(guild, parsed.filter, parsed.page);
    await interaction.editReply({
      components: next.components,
      allowedMentions: { parse: [] },
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That page could not be opened.";
    const notice = scheduleNotice("error", "Page failed", message);
    await interaction.editReply({
      components: notice.components,
      allowedMentions: { parse: [] },
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => undefined);
  }
}
