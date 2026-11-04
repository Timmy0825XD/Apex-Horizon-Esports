import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SectionBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import type { Schedule } from "@prisma/client";
import { emojis } from "../../emojis.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { textBlock } from "../../lib/v2.js";
import { escapeDiscord, roundTitle, scoreLine } from "../room/labels.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById, objectIdLike } from "../tournament/store.js";
import { actorMatches } from "../../lib/command-access.js";
import { thumbnailImageUrl } from "./messages.js";
import {
  cardPayload,
  channelUrl,
  linkButton,
  matchEyebrow,
  quote,
  replySchedule,
  scheduleCard,
  scheduleNotice,
  seatEmoji,
  shortUtc,
  staffInline,
  stampFooter,
  type CardBlock,
  type CardTone,
} from "./respond.js";
import { presentFace } from "./store.js";
import { slashMention } from "../../lib/register-slash.js";

const PAGE_SIZE = 5;
const SHOW_FILTERS = ["all", "pending", "past", "overdue"] as const;

export type ShowFilter = (typeof SHOW_FILTERS)[number];
export type ScheduleStatus = "pending" | "completed" | "overdue";

type ShowQuery = {
  filter: ShowFilter;
  tournamentId: string | null;
  userId: string | null;
};

type Listed = {
  schedule: Schedule;
  left: string;
  right: string;
  round: number;
  tournamentName: string;
  status: ScheduleStatus;
};

const FILTER_LABEL: Record<ShowFilter, string> = {
  all: "All",
  pending: "Pending",
  past: "Past/Completed",
  overdue: "Result pending",
};

const STATUS_EMOJI: Record<ScheduleStatus, string> = {
  pending: emojis.calendar,
  completed: emojis.success,
  overdue: emojis.alert,
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  overdue: "Result pending",
};

const STATUS_TONE: Record<ScheduleStatus, CardTone> = {
  pending: "pending",
  completed: "success",
  overdue: "danger",
};

const FILTER_TONE: Record<ShowFilter, CardTone> = {
  all: "info",
  pending: "pending",
  past: "success",
  overdue: "danger",
};

export function scheduleStatus(row: { results: unknown; scheduledAt: Date }, now = Date.now()): ScheduleStatus {
  if (row.results) {
    return "completed";
  }
  if (row.scheduledAt.getTime() <= now) {
    return "overdue";
  }
  return "pending";
}

export function matchesShowFilter(status: ScheduleStatus, filter: ShowFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "pending") {
    return status === "pending";
  }
  if (filter === "overdue") {
    return status === "overdue";
  }
  return status !== "pending";
}

export function isShowFilter(value: string): value is ShowFilter {
  return (SHOW_FILTERS as readonly string[]).includes(value);
}

function parseFilter(value: string | null): ShowFilter {
  return value && isShowFilter(value) ? value : "all";
}

function showCustomId(page: number, query: ShowQuery): string {
  return `schedule:show:${page}:${query.filter}:${query.tournamentId ?? "0"}:${query.userId ?? "0"}`;
}

function parseShowCustomId(customId: string): { page: number; query: ShowQuery } | null {
  const parts = customId.split(":");
  if (parts.length !== 6 || parts[0] !== "schedule" || parts[1] !== "show") {
    return null;
  }
  const page = Number(parts[2]);
  const filter = parts[3] ?? "";
  const tour = parts[4] ?? "";
  const user = parts[5] ?? "";
  if (!Number.isInteger(page) || page < 0 || page > 500 || !isShowFilter(filter)) {
    return null;
  }
  if (tour !== "0" && !objectIdLike(tour)) {
    return null;
  }
  if (user !== "0" && !/^\d{17,20}$/.test(user)) {
    return null;
  }
  return {
    page,
    query: {
      filter,
      tournamentId: tour === "0" ? null : tour,
      userId: user === "0" ? null : user,
    },
  };
}

function emptyCopy(query: ShowQuery, tournamentName: string | null): { title: string; body: string } {
  const who = query.userId ? formatUser(query.userId) : null;
  const event = tournamentName ? `**${escapeDiscord(tournamentName)}**` : null;
  const phrase =
    query.filter === "pending"
      ? "pending schedules"
      : query.filter === "past"
        ? "past or completed schedules"
        : query.filter === "overdue"
          ? "schedules waiting on a result"
          : null;

  if (who && event) {
    return {
      title: "No schedules",
      body: phrase ? `${who} has no ${phrase} on ${event}.` : `${who} has no judge or recorder seat on ${event}.`,
    };
  }
  if (who) {
    return {
      title: "No assignments",
      body: phrase
        ? `${who} has no ${phrase} on an active tournament.`
        : `${who} has no judge or recorder seat on an active tournament.`,
    };
  }
  if (event) {
    return {
      title: "No schedules",
      body: phrase ? `${event} has no ${phrase}.` : `${event} has no schedules yet.`,
    };
  }
  return {
    title: "No schedules",
    body: phrase ? `No active tournament has ${phrase}.` : "No active tournament has a schedule.",
  };
}

function pager(page: number, pages: number, query: ShowQuery): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(showCustomId(Math.max(page - 1, 0), query))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back))
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId("schedule:show:stay")
      .setLabel(`${page + 1}/${pages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(showCustomId(page + 1, query))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next))
      .setDisabled(page >= pages - 1),
  );
}

async function loadListed(
  guildId: string,
  query: ShowQuery,
): Promise<{ rows: Listed[]; tournamentName: string | null } | "bad-tour" | "inactive"> {
  let tournamentName: string | null = null;
  if (query.tournamentId) {
    if (!objectIdLike(query.tournamentId)) {
      return "bad-tour";
    }
    const tournament = await findTournamentById(guildId, query.tournamentId);
    if (!tournament) {
      return "inactive";
    }
    tournamentName = tournament.name;
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      guildId,
      ...(query.tournamentId ? { tournamentId: query.tournamentId } : {}),
      ...(query.userId ? { OR: [{ judgeId: query.userId }, { recorderId: query.userId }] } : {}),
    },
    orderBy: { scheduledAt: "desc" },
  });
  if (schedules.length === 0) {
    return { rows: [], tournamentName };
  }

  const tournamentIds = [...new Set(schedules.map((row) => row.tournamentId))];
  const [tournaments, matches] = await Promise.all([
    prisma.tournament.findMany({ where: { id: { in: tournamentIds }, guildId }, select: { id: true, name: true } }),
    prisma.match.findMany({ where: { tournamentId: { in: tournamentIds } } }),
  ]);
  const tournamentById = new Map(tournaments.map((row) => [row.id, row]));
  const matchByKey = new Map(matches.map((row) => [`${row.tournamentId}:${row.challongeMatchId}`, row]));
  const now = Date.now();
  const rows: Listed[] = [];
  for (const schedule of schedules) {
    const tournament = tournamentById.get(schedule.tournamentId);
    const match = matchByKey.get(`${schedule.tournamentId}:${schedule.challongeMatchId}`);
    if (!tournament || !match) {
      continue;
    }
    const status = scheduleStatus(schedule, now);
    if (!matchesShowFilter(status, query.filter)) {
      continue;
    }
    rows.push({
      schedule,
      left: match.player1Name,
      right: match.player2Name,
      round: match.round,
      tournamentName: tournament.name,
      status,
    });
  }
  return { rows, tournamentName };
}

function countsLine(rows: Listed[]): string {
  const order: ScheduleStatus[] = ["pending", "completed", "overdue"];
  return order
    .map((status) => [status, rows.filter((row) => row.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `**${count}** ${STATUS_LABEL[status].toLowerCase()}`)
    .join(" · ");
}

function rowSection(guildId: string, row: Listed, showTournament: boolean): SectionBuilder {
  const unix = Math.floor(row.schedule.scheduledAt.getTime() / 1000);
  const where = [`<t:${unix}:R>`, `\`${shortUtc(row.schedule.scheduledAt)}\``, roundTitle(row.round)];
  if (showTournament) where.push(escapeDiscord(row.tournamentName));
  return new SectionBuilder()
    .addTextDisplayComponents(
      textBlock(
        [
          `**${escapeDiscord(row.left)} vs ${escapeDiscord(row.right)}**`,
          where.join(" · "),
          staffInline(row.schedule.judgeId ?? null, row.schedule.recorderId ?? null),
        ].join("\n"),
      ),
    )
    .setButtonAccessory(linkButton("Ticket", channelUrl(guildId, row.schedule.channelId)));
}

function listMessage(guildId: string, actorId: string, query: ShowQuery, rows: Listed[], tournamentName: string | null, page: number): InteractionReplyOptions {
  const eyebrow = [`Filter: ${FILTER_LABEL[query.filter]}`];
  if (tournamentName) eyebrow.push(`Tournament: ${escapeDiscord(tournamentName)}`);
  if (query.userId) eyebrow.push(`Staff: ${formatUser(query.userId)}`);
  if (rows.length === 0) {
    const copy = emptyCopy(query, tournamentName);
    return cardPayload(scheduleCard({ tone: "info", eyebrow: eyebrow.join(" · "), title: copy.title, blocks: [copy.body] }));
  }

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const blocks: CardBlock[] = [countsLine(rows)];
  let previous: ScheduleStatus | null = null;
  for (const row of slice) {
    if (row.status !== previous) {
      blocks.push("divider", `### ${STATUS_EMOJI[row.status]} ${STATUS_LABEL[row.status]}`);
      previous = row.status;
    }
    blocks.push(rowSection(guildId, row, !tournamentName));
  }
  if (pages > 1) {
    blocks.push("divider", pager(safePage, pages, query));
  }
  return cardPayload(
    scheduleCard({
      tone: FILTER_TONE[query.filter],
      emoji: emojis.calendar,
      eyebrow: eyebrow.join(" · "),
      title: "Schedules",
      blocks,
      footer: stampFooter("Requested", actorId),
    }),
  );
}

async function listPayload(guildId: string, actorId: string, query: ShowQuery, page: number): Promise<InteractionReplyOptions> {
  const loaded = await loadListed(guildId, query);
  if (loaded === "bad-tour") {
    return scheduleNotice("error", "Unknown tournament", "Pick a tournament from the list.");
  }
  if (loaded === "inactive") {
    return scheduleNotice("error", "Tournament inactive", "That tournament is no longer active, so its schedules stay hidden.");
  }
  return listMessage(guildId, actorId, query, loaded.rows, loaded.tournamentName, page);
}

function isHttp(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url.trim()));
}

function seatState(seat: "judge" | "recorder", userId: string | null, confirmed: boolean): string {
  const label = seat === "judge" ? "Judge" : "Recorder";
  if (!userId) return `${seatEmoji(seat)} ${label} · *Open*`;
  return `${seatEmoji(seat)} ${label} · ${formatUser(userId)}${confirmed ? " · confirmed" : ""}`;
}

async function detailPayload(guild: Guild, actorId: string, scheduleId: string): Promise<InteractionReplyOptions> {
  if (!objectIdLike(scheduleId)) {
    return scheduleNotice("error", "Unknown match", "Pick a match from the list.");
  }
  const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, guildId: guild.id } });
  if (!schedule) {
    return scheduleNotice("error", "Schedule not found", "That match does not have a schedule in this server.");
  }
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  if (!tournament) {
    return scheduleNotice("error", "Tournament inactive", "That tournament is no longer active, so its schedules stay hidden.");
  }
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
  if (!match) {
    return scheduleNotice("error", "Match missing", "That match is no longer on the bracket.");
  }

  const settings = await loadGuildSettings(guild.id);
  const imageUrl = settings
    ? await thumbnailImageUrl(guild, settings.thumbnailChannelId, schedule.messages.thumbnailMessageId)
    : undefined;
  const face = await presentFace(guild, tournament, match, schedule, imageUrl);
  const status = scheduleStatus(schedule);
  const results = schedule.results;

  const statusParts = [`${STATUS_EMOJI[status]} **${STATUS_LABEL[status]}**`];
  if (results) {
    statusParts.push(`result <t:${Math.floor(results.declaredAt.getTime() / 1000)}:f>`);
    if (results.uploadedBy) statusParts.push(`by ${formatUser(results.uploadedBy)}`);
  } else {
    const unix = Math.floor(schedule.scheduledAt.getTime() / 1000);
    statusParts.push(`<t:${unix}:F> (<t:${unix}:R>)`);
  }
  statusParts.push(`Match \`${schedule.challongeMatchId}\``);

  const after: CardBlock[] = [statusParts.join(" · "), { gallery: isHttp(imageUrl) ? [imageUrl] : [] }];
  if (results) {
    const outcome = [`### ${emojis.winner} Result`, scoreLine(match.player1Name, match.player2Name, results.team1Score, results.team2Score)];
    if (results.notes) outcome.push(quote(results.notes));
    after.push("divider", outcome.join("\n"));
  } else if (schedule.remark) {
    after.push("divider", ["### Remark", quote(schedule.remark)].join("\n"));
  }
  const captains = [face.captain1Id, face.captain2Id].map((id) => (id ? formatUser(id) : "*Unknown*")).join(" · ");
  after.push(
    "divider",
    [
      "### People",
      `${emojis.captains} Captains · ${captains}`,
      seatState("judge", schedule.judgeId ?? null, schedule.confirmations.judge),
      seatState("recorder", schedule.recorderId ?? null, schedule.confirmations.recorder),
    ].join("\n"),
  );

  const links: ButtonBuilder[] = [linkButton("Ticket", channelUrl(guild.id, schedule.channelId))];
  if (settings?.schedulesChannelId && schedule.messages.scheduleChannelMessageId) {
    links.push(linkButton("Schedule post", channelUrl(guild.id, settings.schedulesChannelId, schedule.messages.scheduleChannelMessageId)));
  }
  if (results?.messageId) {
    links.push(linkButton("Results post", channelUrl(guild.id, tournament.resultChannelId, results.messageId)));
  }
  if (isHttp(results?.transcriptUrl)) {
    links.push(linkButton("Transcript", results.transcriptUrl.trim()));
  }
  (results?.links ?? []).filter(isHttp).forEach((url, index) => links.push(linkButton(`Recording ${index + 1}`, url.trim())));
  after.push("divider");
  for (let index = 0; index < links.length; index += 5) {
    after.push(new ActionRowBuilder<ButtonBuilder>().addComponents(links.slice(index, index + 5)));
  }

  return cardPayload(
    scheduleCard({
      tone: STATUS_TONE[status],
      eyebrow: matchEyebrow(tournament.name, match),
      title: `${escapeDiscord(match.player1Name)} vs ${escapeDiscord(match.player2Name)}`,
      blocks: after,
      footer: stampFooter("Requested", actorId),
    }),
  );
}

export async function runShow(interaction: ChatInputCommandInteraction): Promise<void> {
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
        "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to view schedules.",
      ),
    );
    return;
  }
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
  const matchId = interaction.options.getString("match");
  if (matchId) {
    await replySchedule(interaction, await detailPayload(guild, interaction.user.id, matchId));
    return;
  }
  const query: ShowQuery = {
    filter: parseFilter(interaction.options.getString("filter")),
    tournamentId: interaction.options.getString("tour"),
    userId: interaction.options.getUser("user")?.id ?? null,
  };
  await replySchedule(interaction, await listPayload(guild.id, interaction.user.id, query, 0));
}

export async function handleShowButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === "schedule:show:stay") {
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
  const parsed = parseShowCustomId(interaction.customId);
  if (!parsed) {
    await interaction.reply(scheduleNotice("error", "Page expired", `Run ${slashMention(interaction.guildId, "schedule show")} again to open a fresh list.`)).catch(() => undefined);
    return;
  }
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true }))) {
    await interaction.reply(
      scheduleNotice(
        "error",
        "Schedule access required",
        "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to turn this page.",
      ),
    );
    return;
  }
  await interaction.deferUpdate();
  try {
    const next = await listPayload(guild.id, interaction.user.id, parsed.query, parsed.page);
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
