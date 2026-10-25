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
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord, roundLabel } from "../room/labels.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById, objectIdLike } from "../tournament/store.js";
import { actorMatches } from "../../lib/command-access.js";
import { thumbnailImageUrl } from "./messages.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { presentFace } from "./store.js";

const PAGE_SIZE = 5;
const PENDING_COLOR = 0xf1c40f;
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
  pending: "PENDING",
  completed: "COMPLETED",
  overdue: "RESULT PENDING",
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

function listStamp(when: Date): string {
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const day = String(when.getUTCDate()).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${when.getUTCFullYear()}-${month}-${day} ${hour}:${minute} UTC`;
}

function clockStamp(when: Date): string {
  const day = String(when.getUTCDate()).padStart(2, "0");
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${day}-${month}-${when.getUTCFullYear()} ${hour}:${minute} UTC`;
}

function person(id: string | null | undefined): string {
  return id ? formatUser(id) : "*Unassigned*";
}

function listAccent(filter: ShowFilter): number {
  if (filter === "pending") {
    return PENDING_COLOR;
  }
  if (filter === "overdue") {
    return embedColors.error;
  }
  if (filter === "past") {
    return embedColors.success;
  }
  return embedColors.info;
}

function statusAccent(status: ScheduleStatus): number {
  if (status === "completed") {
    return embedColors.success;
  }
  if (status === "overdue") {
    return embedColors.error;
  }
  return PENDING_COLOR;
}

function payload(container: ContainerBuilder): InteractionReplyOptions {
  return { components: [container], flags: v2Flags, allowedMentions: { parse: [] } };
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

function seatLine(schedule: { judgeId: string | null; recorderId: string | null }): string | null {
  const parts: string[] = [];
  if (schedule.judgeId) {
    parts.push(`${emojis.judge} **J** ${formatUser(schedule.judgeId)}`);
  }
  if (schedule.recorderId) {
    parts.push(`${emojis.recorder} **R** ${formatUser(schedule.recorderId)}`);
  }
  return parts.length > 0 ? parts.join("  ") : null;
}

function itemBlock(index: number, row: Listed): string {
  const unix = Math.floor(row.schedule.scheduledAt.getTime() / 1000);
  const badge = numberEmojis[index] ?? `**${index + 1}.**`;
  const lines = [
    `${badge} ${STATUS_EMOJI[row.status]} **${escapeDiscord(row.left)} vs ${escapeDiscord(row.right)}**`,
    `<t:${unix}:R> (\`${listStamp(row.schedule.scheduledAt)}\`)`,
    `${escapeDiscord(row.tournamentName)} | ${STATUS_LABEL[row.status]} | ${emojis.id} \`${row.schedule.challongeMatchId}\``,
  ];
  const staff = seatLine(row.schedule);
  if (staff) {
    lines.push(staff);
  }
  return lines.join("\n");
}

function listBody(rows: Listed[]): string {
  const parts: string[] = [];
  let previous: ScheduleStatus | null = null;
  rows.forEach((row, index) => {
    if (row.status !== previous) {
      parts.push(`## ${STATUS_EMOJI[row.status]} ${STATUS_LABEL[row.status]}`);
      previous = row.status;
    }
    parts.push(itemBlock(index, row));
  });
  return parts.join("\n\n");
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
      tournamentName: tournament.name,
      status,
    });
  }
  return { rows, tournamentName };
}

function listMessage(query: ShowQuery, rows: Listed[], tournamentName: string | null, page: number): InteractionReplyOptions {
  if (rows.length === 0) {
    const copy = emptyCopy(query, tournamentName);
    return payload(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(textBlock(`# ${emojis.info} ${copy.title}`), textBlock(copy.body)),
    );
  }

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const header = [
    `${emojis.calendar} **Page:** \`${safePage + 1}/${pages}\``,
    `${emojis.stats} **Schedules:** \`${rows.length}\``,
    `${emojis.info} **Filter:** ${FILTER_LABEL[query.filter]}`,
  ];
  if (tournamentName) {
    header.push(`${emojis.torneo} **Tournament:** ${escapeDiscord(tournamentName)}`);
  }
  if (query.userId) {
    header.push(`${emojis.judge_recorder} **Staff:** ${formatUser(query.userId)}`);
  }

  const container = new ContainerBuilder()
    .setAccentColor(listAccent(query.filter))
    .addTextDisplayComponents(textBlock(`# ${emojis.calendar} Schedules`), textBlock(header.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(listBody(slice)));
  if (pages > 1) {
    container.addSeparatorComponents(divider()).addActionRowComponents(pager(safePage, pages, query));
  }
  return payload(container);
}

async function listPayload(guildId: string, query: ShowQuery, page: number): Promise<InteractionReplyOptions> {
  const loaded = await loadListed(guildId, query);
  if (loaded === "bad-tour") {
    return scheduleNotice("error", "Unknown tournament", "Pick a tournament from the list.");
  }
  if (loaded === "inactive") {
    return scheduleNotice("error", "Tournament inactive", "That tournament is no longer active, so its schedules stay hidden.");
  }
  return listMessage(query, loaded.rows, loaded.tournamentName, page);
}

function clockLines(kind: "result" | "schedule", when: Date): string {
  const unix = Math.floor(when.getTime() / 1000);
  const prefix = kind === "result" ? "Result " : "";
  return [`**${prefix}UTC Time:** \`${clockStamp(when)}\``, `**${prefix}Local Time:** <t:${unix}:F> (<t:${unix}:R>)`].join("\n");
}

function resultLine(leftName: string, rightName: string, team1: number, team2: number): string {
  const left = `**${escapeDiscord(leftName.toUpperCase())}**`;
  const right = `**${escapeDiscord(rightName.toUpperCase())}**`;
  const leftShown = team1 > team2 ? `${emojis.winner} ${left}` : left;
  const rightShown = team2 > team1 ? `${emojis.winner} ${right}` : right;
  return `${emojis.scoreboard} ${leftShown} \`${team1}\` ${emojis.vs} \`${team2}\` ${rightShown}`;
}

function linkLines(links: string[]): string | null {
  const usable = links.map((link) => link.trim()).filter((link) => /^https?:\/\//i.test(link));
  if (usable.length === 0) {
    return null;
  }
  return usable.map((link, index) => `${emojis.link} [Link ${index + 1}](${link})`).join("\n");
}

function galleryUrls(thumbnail: string | undefined, proofs: string[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of [thumbnail, ...proofs]) {
    const url = raw?.trim() ?? "";
    if (!isGalleryUrl(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
    if (urls.length === 10) {
      break;
    }
  }
  return urls;
}

function isGalleryUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url)) {
    return false;
  }
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(png|jpe?g|gif|webp)$/.test(path)) {
    return true;
  }
  return path.includes("cdn.discordapp.com/") || path.includes("media.discordapp.net/");
}

function messageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function linkButton(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url).setEmoji(customEmoji(emojis.link));
}

async function detailPayload(guild: Guild, scheduleId: string): Promise<InteractionReplyOptions> {
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
  const when = schedule.results?.declaredAt ?? schedule.scheduledAt;
  const meta = [`${emojis.torneo} **Tournament:** ${escapeDiscord(tournament.name)}`];
  if (match.group) {
    meta.push(`${emojis.challonge} **Group:** ${escapeDiscord(match.group)}`);
  }
  meta.push(
    `${emojis.challonge} **Round:** ${roundLabel(match.round)}`,
    `${emojis.textChannel} **Channel:** ${formatChannel(guild, schedule.channelId)}`,
    `${emojis.id} **Match ID:** \`${schedule.challongeMatchId}\``,
  );

  const people = [
    `**Captain 1:** ${person(face.captain1Id)}`,
    `**Captain 2:** ${person(face.captain2Id)}`,
    "",
    "**Staffs:**",
    `${emojis.judge} **Judge:** ${person(schedule.judgeId)}`,
    `${emojis.recorder} **Recorder:** ${person(schedule.recorderId)}`,
  ].join("\n");

  const outcome: string[] = [];
  if (schedule.results) {
    outcome.push("**Results:**", resultLine(match.player1Name, match.player2Name, schedule.results.team1Score, schedule.results.team2Score));
    if (schedule.results.notes) {
      outcome.push("", `**Remarks:** ${escapeDiscord(schedule.results.notes)}`);
    }
    const links = linkLines(schedule.results.links ?? []);
    if (links) {
      outcome.push("", "**Links:**", links);
    }
    if (schedule.results.transcriptUrl && /^https?:\/\//i.test(schedule.results.transcriptUrl)) {
      outcome.push("", `${emojis.transcript} **Transcript:** ${emojis.link} [Click here](${schedule.results.transcriptUrl})`);
    }
  } else if (schedule.remark) {
    outcome.push(`**Remark:** ${escapeDiscord(schedule.remark)}`);
  }

  const container = new ContainerBuilder()
    .setAccentColor(statusAccent(status))
    .addTextDisplayComponents(
      textBlock(
        `# ${emojis.torneo} ${escapeDiscord(match.player1Name.toUpperCase())} ${emojis.vs} ${escapeDiscord(match.player2Name.toUpperCase())}`,
      ),
      textBlock(`${STATUS_EMOJI[status]} **${STATUS_LABEL[status]}**`),
      textBlock(clockLines(schedule.results ? "result" : "schedule", when)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(meta.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(people));

  if (outcome.length > 0) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(outcome.join("\n")));
  }

  const images = galleryUrls(imageUrl, schedule.results?.imageUrls ?? []);
  if (images.length > 0) {
    container.addMediaGalleryComponents((gallery) => {
      for (const url of images) {
        gallery.addItems((item) => item.setURL(url));
      }
      return gallery;
    });
  }

  const footerId = schedule.results?.uploadedBy ?? schedule.createdBy;
  const footerWhen = schedule.results?.declaredAt ?? schedule.createdAt;
  if (footerId) {
    const unix = Math.floor(footerWhen.getTime() / 1000);
    const label = schedule.results?.uploadedBy ? "Uploaded by" : "Created by";
    container.addTextDisplayComponents(textBlock(`-# ${label} ${formatUser(footerId)} · <t:${unix}:f>`));
  }

  const links: ButtonBuilder[] = [];
  if (schedule.results?.messageId) {
    links.push(linkButton("Result Post", messageUrl(guild.id, tournament.resultChannelId, schedule.results.messageId)));
  }
  if (settings?.schedulesChannelId && schedule.messages.scheduleChannelMessageId) {
    links.push(linkButton("Schedule Post", messageUrl(guild.id, settings.schedulesChannelId, schedule.messages.scheduleChannelMessageId)));
  }
  if (links.length > 0) {
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(links));
  }
  return payload(container);
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
    await replySchedule(interaction, await detailPayload(guild, matchId));
    return;
  }
  const query: ShowQuery = {
    filter: parseFilter(interaction.options.getString("filter")),
    tournamentId: interaction.options.getString("tour"),
    userId: interaction.options.getUser("user")?.id ?? null,
  };
  await replySchedule(interaction, await listPayload(guild.id, query, 0));
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
    await interaction.reply(scheduleNotice("error", "Page expired", "Run `/schedule show` again to open a fresh list.")).catch(() => undefined);
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
    const next = await listPayload(guild.id, parsed.query, parsed.page);
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
