import { AttachmentBuilder, ContainerBuilder, type ChatInputCommandInteraction, type Guild } from "discord.js";
import type { Attendance, Schedule, Tournament } from "@prisma/client";
import { emojis } from "../../emojis.js";
import { fetchChallongeBracket } from "../../lib/challonge.js";
import { decryptSecret } from "../../lib/crypto.js";
import { formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { attachedFile, divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { isDefaultWin, payModeForFormat, payModeLabel } from "../attendance/payroll.js";
import { whereActive } from "../attendance/store.js";
import { groupLetters } from "../room/bracket.js";
import { escapeDiscord } from "../room/labels.js";
import { requireOrganiser } from "./access.js";
import { optionalTextChannelFields, roleFields, textChannelFields } from "./fields.js";
import {
  buildOverview,
  buildTodo,
  compareKeys,
  confirmedLabel,
  matchTitle,
  minutesToResult,
  scheduleStatusOf,
  sortKey,
  stageContext,
  stageLabel,
  todoSummary,
  type BracketMatch,
  type RoomRow,
} from "./report-checks.js";
import {
  buildTournamentReport,
  type AttendanceLine,
  type ConfigEntry,
  type OverviewBook,
  type ResultLine,
  type ScheduleLine,
  type TodoLine,
  type WorkLine,
} from "./report-book.js";
import { deferTournament, respondTournament } from "./respond.js";
import { objectIdLike } from "./store.js";
import { tournamentErrorMessage } from "./view.js";

const ACCENT = 0xc6a15a;

function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function slug(name: string): string {
  return name.replace(/[^\w]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "tournament";
}

function titleCase(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    return "—";
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function winnerOf(match: BracketMatch | undefined, team1: number, team2: number): { name: string; tie: boolean } {
  if (team1 === team2) {
    return { name: "Tie", tie: true };
  }
  if (team1 > team2) {
    return { name: match?.player1Name.trim() || "Team 1", tie: false };
  }
  return { name: match?.player2Name.trim() || "Team 2", tie: false };
}

function person(names: Map<string, string>, id: string | null | undefined): { name: string; id: string } {
  if (!id) {
    return { name: "—", id: "—" };
  }
  return { name: names.get(id) ?? id, id };
}

async function loadNames(guild: Guild, ids: Iterable<string>): Promise<Map<string, string>> {
  const unique = [...new Set([...ids].filter((id) => /^\d{17,20}$/.test(id)))];
  const names = new Map<string, string>();
  for (let index = 0; index < unique.length; index += 100) {
    const slice = unique.slice(index, index + 100);
    const members = await guild.members.fetch({ user: slice }).catch(() => null);
    if (!members) {
      continue;
    }
    for (const member of members.values()) {
      names.set(member.id, member.user.username);
    }
  }

  const missing = unique.filter((id) => !names.has(id));
  for (let index = 0; index < missing.length; index += 8) {
    const slice = missing.slice(index, index + 8);
    const users = await Promise.all(slice.map((id) => guild.client.users.fetch(id).catch(() => null)));
    users.forEach((user, offset) => {
      const id = slice[offset];
      if (user && id) {
        names.set(id, user.username);
      }
    });
  }
  return names;
}

function resource(guild: Guild, id: string, kind: "role" | "channel"): string {
  if (kind === "role") {
    const role = guild.roles.cache.get(id);
    return role ? `${role.name} · ${id}` : `Missing · ${id}`;
  }
  const channel = guild.channels.cache.get(id);
  return channel ? `${channel.name} · ${id}` : `Missing · ${id}`;
}

function channelName(guild: Guild, id: string | null | undefined): string {
  if (!id) {
    return "—";
  }
  return guild.channels.cache.get(id)?.name ?? `Deleted · ${id}`;
}

function workLines(rows: Attendance[], names: Map<string, string>): WorkLine[] {
  const buckets = new Map<string, WorkLine>();
  const touch = (userId: string): WorkLine => {
    const current = buckets.get(userId);
    if (current) {
      return current;
    }
    const created: WorkLine = {
      username: person(names, userId).name,
      userId,
      both: 0,
      judge: 0,
      recorder: 0,
      defaultWins: 0,
      totalRounds: 0,
      gamesBoth: 0,
      gamesJudge: 0,
      gamesRecorder: 0,
      totalGames: 0,
    };
    buckets.set(userId, created);
    return created;
  };

  for (const row of rows) {
    const games = row.team1Score + row.team2Score;
    const defaultWin = isDefaultWin(row.remark);
    if (row.judgeId === row.recorderId) {
      const line = touch(row.judgeId);
      line.both += 1;
      line.gamesBoth += games;
      if (defaultWin) {
        line.defaultWins += 1;
      }
      continue;
    }
    const judge = touch(row.judgeId);
    judge.judge += 1;
    judge.gamesJudge += games;
    if (defaultWin) {
      judge.defaultWins += 1;
    }
    const recorder = touch(row.recorderId);
    recorder.recorder += 1;
    recorder.gamesRecorder += games;
    if (defaultWin) {
      recorder.defaultWins += 1;
    }
  }

  for (const line of buckets.values()) {
    line.totalRounds = line.both + line.judge + line.recorder;
    line.totalGames = line.gamesBoth + line.gamesJudge + line.gamesRecorder;
  }

  return [...buckets.values()].sort(
    (left, right) =>
      right.totalGames - left.totalGames || right.totalRounds - left.totalRounds || left.username.localeCompare(right.username),
  );
}

function httpLink(value: string | null | undefined): string | undefined {
  const link = value?.trim();
  if (!link || !/^https?:\/\//i.test(link)) {
    return undefined;
  }
  return link;
}

type BracketRead = {
  matches: BracketMatch[];
  /** Read from Challonge when the command ran, or the copy stored at the last ticket sync. */
  live: boolean;
};

/** Reads the bracket once, now. Falls back to the stored copy when Challonge cannot be reached. */
async function readBracket(tournament: Tournament, stored: BracketMatch[]): Promise<BracketRead> {
  try {
    const bracket = await fetchChallongeBracket(tournament.challongeId, decryptSecret(tournament.challongeKeyEnc));
    const letters = groupLetters(bracket.matches);
    const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));
    return {
      live: true,
      matches: bracket.matches.map((match) => ({
        challongeMatchId: match.id,
        state: match.state,
        round: match.round,
        group: match.groupId == null ? null : (letters.get(match.groupId) ?? null),
        thirdPlace: match.thirdPlace,
        player1Name: names.get(match.player1Id ?? -1) ?? "",
        player2Name: names.get(match.player2Id ?? -1) ?? "",
      })),
    };
  } catch (error) {
    console.error(`Tournament report could not read Challonge for ${tournament.id}; using stored matches`, error);
    return { live: false, matches: stored };
  }
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}

export async function handleTournamentReport(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(interaction, tournamentErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }
  if (!(await requireOrganiser(interaction, "export a tournament report"))) {
    return;
  }

  await deferTournament(interaction, true);
  const tournamentId = interaction.options.getString("tournament", true);
  if (!objectIdLike(tournamentId)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  const tournament = await prisma.tournament
    .findFirst({ where: { id: tournamentId, guildId: guild.id } })
    .catch(() => null);
  if (!tournament) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "That tournament is not registered in this server.", false),
    );
    return;
  }

  try {
    const [marks, storedMatches, schedules, rooms, attendanceTotal] = await Promise.all([
      prisma.attendance.findMany({
        where: whereActive({ guildId: guild.id, tournamentId: tournament.id }),
        orderBy: { createdAt: "asc" },
      }),
      prisma.match.findMany({ where: { tournamentId: tournament.id } }),
      prisma.schedule.findMany({ where: { guildId: guild.id, tournamentId: tournament.id } }),
      prisma.room.findMany({
        where: { guildId: guild.id, tournamentId: tournament.id },
        select: { challongeMatchId: true, channelId: true, status: true },
      }) as Promise<RoomRow[]>,
      prisma.attendance.count({
        where: { guildId: guild.id, tournamentId: tournament.id },
      }).catch(() => 0),
    ]);

    const generatedAt = new Date();
    const bracket = await readBracket(tournament, storedMatches);
    // Stored rows fill any match Challonge no longer returns (deleted or reset), so old records keep their names.
    const faces = new Map<number, BracketMatch>(storedMatches.map((match) => [match.challongeMatchId, match]));
    for (const match of bracket.matches) {
      faces.set(match.challongeMatchId, match);
    }
    const context = stageContext(bracket.matches);
    const attendanceByMatch = new Map<number, Attendance>();
    for (const mark of marks) {
      attendanceByMatch.set(mark.challongeMatchId, mark);
    }
    const scheduleByMatch = new Map<number, Schedule>();
    for (const schedule of schedules) {
      scheduleByMatch.set(schedule.challongeMatchId, schedule);
    }
    const roomByMatch = new Map(rooms.map((room) => [room.challongeMatchId, room]));

    const ids = new Set<string>([tournament.createdBy]);
    for (const mark of marks) {
      ids.add(mark.judgeId);
      ids.add(mark.recorderId);
      ids.add(mark.createdBy);
    }
    for (const schedule of schedules) {
      if (schedule.judgeId) {
        ids.add(schedule.judgeId);
      }
      if (schedule.recorderId) {
        ids.add(schedule.recorderId);
      }
      if (schedule.results?.uploadedBy) {
        ids.add(schedule.results.uploadedBy);
      }
    }

    await guild.roles.fetch().catch(() => undefined);
    await guild.channels.fetch().catch(() => undefined);
    const names = await loadNames(guild, ids);
    const generatedLabel = stamp(generatedAt);
    const mode = payModeLabel(payModeForFormat(tournament.format));
    const ticketOf = (matchId: number, fallbackChannelId?: string | null) =>
      channelName(guild, roomByMatch.get(matchId)?.channelId ?? fallbackChannelId);

    const attendance: AttendanceLine[] = [...marks]
      .sort((left, right) => {
        const order = compareKeys(
          sortKey(faces.get(left.challongeMatchId), left.challongeMatchId),
          sortKey(faces.get(right.challongeMatchId), right.challongeMatchId),
        );
        if (order !== 0) {
          return order;
        }
        return left.createdAt.getTime() - right.createdAt.getTime();
      })
      .map((mark) => {
        const match = faces.get(mark.challongeMatchId);
        const winner = winnerOf(match, mark.team1Score, mark.team2Score);
        const judge = person(names, mark.judgeId);
        const recorder = person(names, mark.recorderId);
        const markedBy = person(names, mark.createdBy);
        const defaultWin = isDefaultWin(mark.remark);
        const schedule = scheduleByMatch.get(mark.challongeMatchId);
        return {
          stage: stageLabel(match, context),
          matchId: mark.challongeMatchId,
          match: matchTitle(match, mark.challongeMatchId),
          ticket: ticketOf(mark.challongeMatchId, schedule?.channelId),
          judge: judge.name,
          judgeId: judge.id,
          recorder: recorder.name,
          recorderId: recorder.id,
          bothSeats: mark.judgeId === mark.recorderId,
          team1: mark.team1Score,
          team2: mark.team2Score,
          games: mark.team1Score + mark.team2Score,
          winner: winner.name,
          tie: winner.tie,
          remark: defaultWin ? "Default win" : mark.remark?.trim() || "—",
          defaultWin,
          recordings: mark.links,
          proof: schedule?.results?.imageUrls ?? [],
          resultDeclared: Boolean(schedule?.results),
          markedBy: markedBy.name,
          markedAt: stamp(mark.createdAt),
        };
      });

    const bracketOrder = (left: Schedule, right: Schedule) =>
      compareKeys(
        sortKey(faces.get(left.challongeMatchId), left.challongeMatchId),
        sortKey(faces.get(right.challongeMatchId), right.challongeMatchId),
      ) || left.scheduledAt.getTime() - right.scheduledAt.getTime();

    const results: ResultLine[] = schedules
      .filter((schedule) => schedule.results)
      .sort(bracketOrder)
      .map((schedule) => {
        const declared = schedule.results!;
        const match = faces.get(schedule.challongeMatchId);
        const winner = winnerOf(match, declared.team1Score, declared.team2Score);
        const attendanceMark = attendanceByMatch.get(schedule.challongeMatchId);
        const defaultWin = isDefaultWin(attendanceMark?.remark);
        const judge = person(names, schedule.judgeId);
        const recorder = person(names, schedule.recorderId);
        const declaredBy = person(names, declared.uploadedBy);
        return {
          stage: stageLabel(match, context),
          matchId: schedule.challongeMatchId,
          match: matchTitle(match, schedule.challongeMatchId),
          state: titleCase(match?.state ?? ""),
          team1: declared.team1Score,
          team2: declared.team2Score,
          winner: winner.name,
          tie: winner.tie,
          outcome: defaultWin ? "Default win" : winner.tie ? "Tie" : "Decision",
          defaultWin,
          judge: judge.name,
          judgeId: judge.id,
          recorder: recorder.name,
          recorderId: recorder.id,
          declaredBy: declaredBy.name,
          declaredById: declaredBy.id,
          declaredAt: stamp(declared.declaredAt),
          scheduledAt: stamp(schedule.scheduledAt),
          resultAfter: minutesToResult(schedule),
          attendanceMarked: Boolean(attendanceMark),
          notes: declared.notes?.trim() || "—",
          scheduleNote: schedule.remark?.trim() || "—",
          transcript: declared.transcriptUrl,
          recordings: declared.links ?? [],
          proof: declared.imageUrls ?? [],
        };
      });

    const scheduleLines: ScheduleLine[] = [...schedules].sort(bracketOrder).map((schedule) => {
      const match = faces.get(schedule.challongeMatchId);
      return {
        stage: stageLabel(match, context),
        matchId: schedule.challongeMatchId,
        match: matchTitle(match, schedule.challongeMatchId),
        status: scheduleStatusOf(schedule, generatedAt),
        scheduledAt: stamp(schedule.scheduledAt),
        declaredAt: schedule.results ? stamp(schedule.results.declaredAt) : "—",
        resultAfter: minutesToResult(schedule),
        judge: schedule.judgeId ? person(names, schedule.judgeId).name : "Open",
        recorder: schedule.recorderId ? person(names, schedule.recorderId).name : "Open",
        confirmed: confirmedLabel(schedule),
        score: schedule.results ? `${schedule.results.team1Score} - ${schedule.results.team2Score}` : "—",
        ticket: ticketOf(schedule.challongeMatchId, schedule.channelId),
        note: schedule.remark?.trim() || "—",
      };
    });

    const todoItems = buildTodo({ matches: bracket.matches, rooms, marks, schedules, now: generatedAt });
    const todo: TodoLine[] = todoItems.map((item) => ({
      priority: item.priority,
      check: item.label,
      stage: item.stage,
      matchId: item.matchId,
      match: item.match,
      ticket: channelName(guild, item.channelId),
      fix: item.fix,
      detail: item.detail,
    }));

    const work = workLines(marks, names);
    const overview = buildOverview({ matches: bracket.matches, rooms, marks, schedules });
    const totals = overview.totals;
    const openWithTicket = bracket.matches.filter(
      (match) => match.state.toLowerCase() === "open" && roomByMatch.has(match.challongeMatchId),
    ).length;
    const defaultWins = marks.filter((mark) => isDefaultWin(mark.remark)).length;
    const highItems = todoItems.filter((item) => item.priority === "high").length;
    const upcoming = scheduleLines.filter((line) => line.status === "Upcoming");
    const delays = schedules.map(minutesToResult).filter((value): value is number => value != null);
    const sourceLabel = bracket.live
      ? "Bracket read from Challonge"
      : "Challonge did not answer · bracket from the last ticket sync";

    const overviewBook: OverviewBook = {
      source: sourceLabel,
      kpis: [
        { value: `${totals.complete} / ${totals.matches}`, label: `Matches complete · ${percent(totals.complete, totals.matches)}` },
        { value: String(totals.open), label: `Open now · ${openWithTicket} with a ticket` },
        { value: String(results.length), label: "Results declared" },
        { value: String(marks.length), label: `Attendance marks · ${defaultWins} DW` },
        { value: String(todoItems.length), label: `To do · ${highItems} high` },
      ],
      stages: overview.stages,
      totals,
      topStaff: work.slice(0, 5).map((line) => ({ username: line.username, rounds: line.totalRounds, games: line.totalGames })),
      schedules: [
        { label: "Schedules", value: String(schedules.length) },
        { label: "Completed", value: String(results.length) },
        { label: "Overdue", value: String(scheduleLines.filter((line) => line.status === "Overdue").length) },
        { label: "Upcoming", value: String(upcoming.length) },
        {
          label: "Upcoming with judge and recorder",
          value: `${upcoming.filter((line) => line.judge !== "Open" && line.recorder !== "Open").length} / ${upcoming.length}`,
        },
        {
          label: "Average time to result",
          value: delays.length === 0 ? "—" : `${Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length)} min`,
        },
      ],
    };

    const openRooms = rooms.filter((room) => room.status === "open").length;
    const closedRooms = rooms.filter((room) => room.status === "closed").length;
    const otherRooms = rooms.length - openRooms - closedRooms;
    const creator = person(names, tournament.createdBy);
    const sheetLink = httpLink(tournament.sheetLink);
    const config: ConfigEntry[] = [
      { kind: "section", title: "Identity" },
      { kind: "field", label: "Tournament", value: tournament.name },
      { kind: "field", label: "Challonge ID", value: tournament.challongeId },
      { kind: "field", label: "Format", value: tournament.format || "—" },
      { kind: "field", label: "Extra columns", value: String(tournament.additionalFieldCount) },
      { kind: "field", label: "Pay table", value: mode },
      {
        kind: "field",
        label: "Participant sheet",
        value: tournament.sheetLink || "—",
        ...(sheetLink ? { link: sheetLink } : {}),
      },
      { kind: "field", label: "Auto-room capable", value: tournament.autoRoomCapable ? "Yes" : "No" },
      { kind: "field", label: "Auto-room", value: tournament.autoRoomRunning ? "On" : "Off" },
      { kind: "field", label: "API key", value: "Stored encrypted" },
      { kind: "section", title: "Roles" },
      ...roleFields.map((field) => ({
        kind: "field" as const,
        label: field.label,
        value: resource(guild, tournament[field.key], "role"),
      })),
      { kind: "section", title: "Channels" },
      ...textChannelFields.map((field) => ({
        kind: "field" as const,
        label: field.label,
        value: resource(guild, tournament[field.key], "channel"),
      })),
      ...optionalTextChannelFields.map((field) => ({
        kind: "field" as const,
        label: field.label,
        value: tournament[field.key] ? resource(guild, tournament[field.key] as string, "channel") : "Not configured",
      })),
      { kind: "section", title: "Ticket categories" },
      { kind: "field", label: "Closed tickets", value: resource(guild, tournament.closedTicketCategoryId, "channel") },
      {
        kind: "field",
        label: "Closed tickets 2",
        value: tournament.closeTicketCategory2Id
          ? resource(guild, tournament.closeTicketCategory2Id, "channel")
          : "Not configured",
      },
      ...[0, 1, 2, 3].map((index) => {
        const id = tournament.ticketOpenCategoryIds[index];
        return {
          kind: "field" as const,
          label: `Open tickets ${index + 1}`,
          value: id ? resource(guild, id, "channel") : "Not configured",
        };
      }),
      { kind: "section", title: "Record" },
      { kind: "field", label: "Created by", value: creator.id === "—" ? "—" : `${creator.name} · ${creator.id}` },
      { kind: "field", label: "Created at", value: stamp(tournament.createdAt) },
      { kind: "field", label: "Updated at", value: stamp(tournament.updatedAt) },
      { kind: "field", label: "Server", value: guild.name },
      { kind: "field", label: "Server ID", value: guild.id },
      { kind: "field", label: "Generated at", value: generatedLabel },
      { kind: "section", title: "Snapshot" },
      { kind: "field", label: "Bracket source", value: sourceLabel },
      { kind: "field", label: "Matches on the bracket", value: String(bracket.matches.length) },
      { kind: "field", label: "Rooms open", value: String(openRooms) },
      { kind: "field", label: "Rooms closed", value: String(closedRooms) },
      ...(otherRooms > 0 ? [{ kind: "field" as const, label: "Rooms in another state", value: String(otherRooms) }] : []),
      { kind: "field", label: "Schedules", value: String(schedules.length) },
      { kind: "field", label: "Results declared", value: String(results.length) },
      { kind: "field", label: "Attendance marks", value: String(marks.length) },
      { kind: "field", label: "Attendance removed", value: String(Math.max(0, attendanceTotal - marks.length)) },
      { kind: "field", label: "People on the board", value: String(work.length) },
    ];

    const filename = `${slug(tournament.name)}-report.xlsx`;
    const buffer = await buildTournamentReport({
      tournamentName: tournament.name,
      generatedLabel,
      payModeLabel: mode,
      overview: overviewBook,
      todo,
      schedules: scheduleLines,
      attendance,
      work,
      results,
      config,
    });

    const stageLine =
      totals.matches === 0
        ? "The bracket has no matches yet."
        : overview.currentStage
          ? `**${escapeDiscord(overview.currentStage)}** in progress`
          : "Bracket complete";
    const heading = `# ${emojis.torneo} Tournament report`;
    const summary = `**${escapeDiscord(tournament.name)}** · ${stageLine}`;
    const progress = [
      "-# Progress",
      `\`${totals.complete} / ${totals.matches}\` matches complete · **${percent(totals.complete, totals.matches)}**`,
      `\`${totals.open}\` open · \`${totals.pending}\` pending`,
      "-# Records",
      `\`${marks.length}\` attendance · \`${results.length}\` results · \`${work.length}\` staff on the board`,
    ].join("\n");
    const highRows = todoSummary(todoItems).filter((row) => row.priority === "high");
    const lower = todoItems.length - highItems;
    const todoText =
      todoItems.length === 0
        ? `${emojis.success} Nothing to fix. Every check passed.`
        : [
            `-# ${emojis.alert} To do · ${todoItems.length}`,
            ...highRows.map((row) => `\`${row.count}\` ${row.label.charAt(0).toLowerCase()}${row.label.slice(1)}`),
            ...(lower > 0
              ? [`*${highRows.length > 0 ? "And " : ""}${lower} lower-priority ${lower === 1 ? "item" : "items"} in the workbook.*`]
              : []),
          ].join("\n");
    const footer = `-# Requested by ${formatUser(interaction.user.id)} · ${
      bracket.live ? "bracket read from Challonge" : "Challonge did not answer, bracket from the last ticket sync"
    }`;

    const icon = guild.iconURL({ extension: "png", size: 256 });
    const container = new ContainerBuilder().setAccentColor(ACCENT);
    if (icon) {
      container.addSectionComponents(headingWithThumbnail(heading, icon, summary));
    } else {
      container.addTextDisplayComponents(textBlock(heading), textBlock(summary));
    }
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(progress))
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(todoText))
      .addSeparatorComponents(divider())
      .addFileComponents(attachedFile(filename))
      .addTextDisplayComponents(textBlock(footer));

    await interaction.editReply({
      components: [container],
      files: [new AttachmentBuilder(buffer, { name: filename })],
      flags: v2Flags,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(`Tournament report failed for ${tournament.id}`, error);
    await respondTournament(
      interaction,
      tournamentErrorMessage("Report failed", "The workbook could not be built. Try again in a moment.", false),
    );
  }
}
