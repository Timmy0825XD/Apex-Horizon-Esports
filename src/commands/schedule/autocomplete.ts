import type { AutocompleteInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
import { prisma } from "../../lib/prisma.js";
import { objectIdLike } from "../tournament/store.js";
import { isShowFilter, matchesShowFilter, scheduleStatus, type ScheduleStatus } from "./show.js";

function shortStamp(when: Date): string {
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${when.getUTCMonth() + 1}/${when.getUTCDate()} ${hour}:${minute}`;
}

function matchTag(status: ScheduleStatus): string {
  if (status === "completed") {
    return "Done";
  }
  if (status === "overdue") {
    return "Overdue";
  }
  return "Pending";
}

function fitChoice(label: string): string {
  const stamp = label.match(/ \([^)]*\)$/)?.[0] ?? "";
  const head = stamp ? label.slice(0, -stamp.length) : label;
  const room = 100 - stamp.length;
  const clipped = head.length > room ? `${head.slice(0, Math.max(room - 1, 0))}…` : head;
  return `${clipped}${stamp}`.slice(0, 100);
}

// Autocomplete must answer within 3 s: read only the fields the labels use and join through maps.
const scheduleChoiceFields = {
  id: true,
  tournamentId: true,
  challongeMatchId: true,
  channelId: true,
  scheduledAt: true,
  results: true,
} as const;

const matchNameFields = { tournamentId: true, challongeMatchId: true, player1Name: true, player2Name: true } as const;

function matchKey(tournamentId: string, challongeMatchId: number): string {
  return `${tournamentId}:${challongeMatchId}`;
}

function byMatchKey<T extends { tournamentId: string; challongeMatchId: number }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [matchKey(row.tournamentId, row.challongeMatchId), row]));
}

function utcStamp(when: Date): string {
  const day = String(when.getUTCDate()).padStart(2, "0");
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${when.getUTCFullYear()}-${month}-${day} ${hour}:${minute} UTC`;
}

export async function handleScheduleAuto(interaction: AutocompleteInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }
  const focused = interaction.options.getFocused(true);
  const sub = interaction.options.getSubcommand(false);
  if (sub === "show" && !(await actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true }))) {
    await interaction.respond([]);
    return;
  }
  if (sub === "refresh" && !(await actorMatches(interaction, { organiser: true, helper: true, staff: true, judge: true, recorder: true }))) {
    await interaction.respond([]);
    return;
  }

  if (sub === "refresh" && focused.name === "match") {
    const query = focused.value.trim().toLowerCase();
    const now = new Date();
    const upcoming = await prisma.schedule.findMany({
      where: { guildId, scheduledAt: { gt: now } },
      orderBy: { scheduledAt: "asc" },
      select: scheduleChoiceFields,
    });
    const channelIds = [...new Set(upcoming.map((row) => row.channelId))];
    const rooms = channelIds.length
      ? await prisma.room.findMany({ where: { channelId: { in: channelIds } }, select: { channelId: true, status: true } })
      : [];
    const closed = new Set(rooms.filter((room) => room.status === "closed").map((room) => room.channelId));
    const schedules = upcoming.filter((row) => !row.results && !closed.has(row.channelId));
    const tournamentIds = [...new Set(schedules.map((row) => row.tournamentId))];
    if (tournamentIds.length === 0) {
      await interaction.respond([]);
      return;
    }
    const [tournaments, matches] = await Promise.all([
      prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true } }),
      prisma.match.findMany({ where: { tournamentId: { in: tournamentIds } }, select: matchNameFields }),
    ]);
    const tournamentNames = new Map(tournaments.map((row) => [row.id, row.name]));
    const matchByKey = byMatchKey(matches);
    const choices = schedules
      .map((schedule) => {
        const tournamentName = tournamentNames.get(schedule.tournamentId);
        const match = matchByKey.get(matchKey(schedule.tournamentId, schedule.challongeMatchId));
        if (tournamentName == null || !match) {
          return null;
        }
        const names = `${match.player1Name} vs ${match.player2Name}`;
        const label = `${names} | ${tournamentName} | ${utcStamp(schedule.scheduledAt)}`;
        return { name: label.slice(0, 100), value: schedule.id, haystack: label.toLowerCase() };
      })
      .filter((choice): choice is { name: string; value: string; haystack: string } => choice !== null)
      .filter((choice) => !query || choice.haystack.includes(query))
      .slice(0, 25)
      .map(({ name, value }) => ({ name, value }));
    await interaction.respond(choices);
    return;
  }

  if (sub === "show" && focused.name === "tour") {
    const query = focused.value.trim().toLowerCase();
    const tournaments = await prisma.tournament.findMany({ where: { guildId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    await interaction.respond(
      tournaments
        .filter((row) => !query || row.name.toLowerCase().includes(query))
        .slice(0, 25)
        .map((row) => ({ name: row.name.slice(0, 100), value: row.id })),
    );
    return;
  }

  if (sub === "show" && focused.name === "match") {
    const query = focused.value.trim().toLowerCase();
    const tourRaw = interaction.options.getString("tour");
    const tourId = tourRaw && objectIdLike(tourRaw) ? tourRaw : null;
    const userRaw = interaction.options.get("user")?.value;
    const userId = typeof userRaw === "string" && /^\d{17,20}$/.test(userRaw) ? userRaw : null;
    const filterRaw = interaction.options.getString("filter");
    const filter = filterRaw && isShowFilter(filterRaw) ? filterRaw : "all";
    const tournaments = await prisma.tournament.findMany({
      where: { guildId, ...(tourId ? { id: tourId } : {}) },
      select: { id: true, name: true },
    });
    const ids = tournaments.map((row) => row.id);
    if (ids.length === 0) {
      await interaction.respond([]);
      return;
    }
    const [schedules, matches] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          guildId,
          tournamentId: { in: ids },
          ...(userId ? { OR: [{ judgeId: userId }, { recorderId: userId }] } : {}),
        },
        orderBy: { scheduledAt: "desc" },
        select: scheduleChoiceFields,
      }),
      prisma.match.findMany({ where: { tournamentId: { in: ids } }, select: matchNameFields }),
    ]);
    const named = new Map(tournaments.map((row) => [row.id, row.name]));
    const matchByKey = byMatchKey(matches);
    const choices = schedules
      .map((schedule) => {
        const match = matchByKey.get(matchKey(schedule.tournamentId, schedule.challongeMatchId));
        if (!match) {
          return null;
        }
        const status = scheduleStatus(schedule);
        if (!matchesShowFilter(status, filter)) {
          return null;
        }
        const names = `${match.player1Name} vs ${match.player2Name}`;
        const label = `[${matchTag(status)}] ${names} (${shortStamp(schedule.scheduledAt)})`;
        const haystack = `${names} ${schedule.challongeMatchId} ${named.get(schedule.tournamentId) ?? ""} ${matchTag(status)}`.toLowerCase();
        return { name: fitChoice(label), value: schedule.id, haystack };
      })
      .filter((choice): choice is { name: string; value: string; haystack: string } => Boolean(choice?.name))
      .filter((choice) => !query || choice.haystack.includes(query))
      .slice(0, 25)
      .map(({ name, value }) => ({ name, value }));
    await interaction.respond(choices);
    return;
  }

  if (focused.name === "tournament") {
    const query = focused.value.trim().toLowerCase();
    const tournaments = await prisma.tournament.findMany({ where: { guildId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    await interaction.respond(
      tournaments
        .filter((row) => !query || row.name.toLowerCase().includes(query))
        .slice(0, 25)
        .map((row) => ({ name: row.name.slice(0, 100), value: row.id })),
    );
    return;
  }
  const tournamentId = interaction.options.getString("tournament");
  if (!tournamentId) {
    await interaction.respond([]);
    return;
  }
  const query = focused.value.trim().toLowerCase();
  const [schedules, matches] = await Promise.all([
    prisma.schedule.findMany({ where: { guildId, tournamentId }, orderBy: { scheduledAt: "asc" }, select: scheduleChoiceFields }),
    prisma.match.findMany({ where: { tournamentId }, select: matchNameFields }),
  ]);
  const matchByKey = byMatchKey(matches);
  const choices = schedules
    .map((schedule) => {
      const match = matchByKey.get(matchKey(schedule.tournamentId, schedule.challongeMatchId));
      const label = match ? `${match.player1Name} vs ${match.player2Name}` : `Match ${schedule.challongeMatchId}`;
      return { name: label.slice(0, 100), value: String(schedule.challongeMatchId), haystack: label.toLowerCase() };
    })
    .filter((choice) => !query || choice.haystack.includes(query))
    .slice(0, 25)
    .map(({ name, value }) => ({ name, value }));
  await interaction.respond(choices);
}
