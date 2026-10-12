import { AttachmentBuilder, ContainerBuilder, type ChatInputCommandInteraction, type Guild } from "discord.js";
import type { Attendance, Match, Schedule } from "@prisma/client";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { attachedFile, divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { isDefaultWin, payModeForFormat, payModeLabel } from "../attendance/payroll.js";
import { whereActive } from "../attendance/store.js";
import { escapeDiscord } from "../room/labels.js";
import { requireOrganiser } from "./access.js";
import { optionalTextChannelFields, roleFields, textChannelFields } from "./fields.js";
import { deferTournament, respondTournament } from "./respond.js";
import { objectIdLike } from "./store.js";
import { tournamentErrorMessage } from "./view.js";
import { buildTournamentReport, type AttendanceLine, type ConfigEntry, type ResultLine, type WorkLine } from "./report-book.js";

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

type StageContext = {
  lastWinnerRound: number | null;
  hasLosers: boolean;
};

function stageContext(matches: Match[]): StageContext {
  const winners = matches.filter((match) => !match.group && match.round > 0).map((match) => match.round);
  return {
    lastWinnerRound: winners.length > 0 ? Math.max(...winners) : null,
    hasLosers: matches.some((match) => !match.group && match.round < 0),
  };
}

function stageLabel(match: Match | undefined, context: StageContext): string {
  if (!match) {
    return "—";
  }
  if (match.group) {
    return `Group ${match.group} · Round ${match.round}`;
  }
  if (match.thirdPlace) {
    return "3rd place";
  }
  if (match.round < 0) {
    return `Losers round ${Math.abs(match.round)}`;
  }
  if (context.lastWinnerRound != null && match.round === context.lastWinnerRound) {
    return context.hasLosers ? "Grand final" : "Final";
  }
  if (context.lastWinnerRound != null && !context.hasLosers && match.round === context.lastWinnerRound - 1) {
    return "Semifinal";
  }
  return `Round ${match.round}`;
}

function sortKey(match: Match | undefined, matchId: number): [number, string, number, number] {
  if (!match) {
    return [4, "", 0, matchId];
  }
  if (match.group) {
    return [0, match.group, match.round, matchId];
  }
  if (match.thirdPlace) {
    return [2, "", match.round, matchId];
  }
  if (match.round < 0) {
    return [3, "", Math.abs(match.round), matchId];
  }
  return [1, "", match.round, matchId];
}

function compareKeys(left: [number, string, number, number], right: [number, string, number, number]): number {
  if (left[0] !== right[0]) {
    return left[0] - right[0];
  }
  if (left[1] !== right[1]) {
    return left[1] < right[1] ? -1 : 1;
  }
  if (left[2] !== right[2]) {
    return left[2] - right[2];
  }
  return left[3] - right[3];
}

function matchTitle(match: Match | undefined, matchId: number): string {
  const left = match?.player1Name.trim();
  const right = match?.player2Name.trim();
  if (!left && !right) {
    return `Match ${matchId}`;
  }
  return `${left || "Team 1"} vs ${right || "Team 2"}`;
}

function winnerOf(match: Match | undefined, team1: number, team2: number): { name: string; tie: boolean } {
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
    const [marks, matches, schedules, rooms, attendanceTotal] = await Promise.all([
      prisma.attendance.findMany({
        where: whereActive({ guildId: guild.id, tournamentId: tournament.id }),
        orderBy: { createdAt: "asc" },
      }),
      prisma.match.findMany({ where: { tournamentId: tournament.id } }),
      prisma.schedule.findMany({ where: { guildId: guild.id, tournamentId: tournament.id } }),
      prisma.room.findMany({
        where: { guildId: guild.id, tournamentId: tournament.id },
        select: { status: true },
      }),
      prisma.attendance.count({
        where: { guildId: guild.id, tournamentId: tournament.id },
      }).catch(() => 0),
    ]);

    const generatedAt = new Date();
    const faces = new Map(matches.map((match) => [match.challongeMatchId, match]));
    const context = stageContext(matches);
    const attendanceByMatch = new Map<number, Attendance>();
    for (const mark of marks) {
      attendanceByMatch.set(mark.challongeMatchId, mark);
    }
    const scheduleByMatch = new Map<number, Schedule>();
    for (const schedule of schedules) {
      scheduleByMatch.set(schedule.challongeMatchId, schedule);
    }

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
        const remark = defaultWin ? "Default win" : mark.remark?.trim() || "—";
        return {
          stage: stageLabel(match, context),
          matchId: mark.challongeMatchId,
          match: matchTitle(match, mark.challongeMatchId),
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
          remark,
          defaultWin,
          recordings: mark.links,
          proof: scheduleByMatch.get(mark.challongeMatchId)?.results?.imageUrls ?? [],
          markedBy: markedBy.name,
          markedAt: stamp(mark.createdAt),
        };
      });

    const results: ResultLine[] = schedules
      .flatMap((schedule) => {
        const declared = schedule.results;
        if (!declared) {
          return [];
        }
        const match = faces.get(schedule.challongeMatchId);
        const winner = winnerOf(match, declared.team1Score, declared.team2Score);
        const attendanceMark = attendanceByMatch.get(schedule.challongeMatchId);
        const defaultWin = isDefaultWin(attendanceMark?.remark);
        const judge = person(names, schedule.judgeId);
        const recorder = person(names, schedule.recorderId);
        const declaredBy = person(names, declared.uploadedBy);
        const outcome = defaultWin ? "Default win" : winner.tie ? "Tie" : "Decision";
        return [
          {
            stage: stageLabel(match, context),
            matchId: schedule.challongeMatchId,
            match: matchTitle(match, schedule.challongeMatchId),
            state: titleCase(match?.state ?? ""),
            team1: declared.team1Score,
            team2: declared.team2Score,
            winner: winner.name,
            tie: winner.tie,
            outcome,
            defaultWin,
            judge: judge.name,
            judgeId: judge.id,
            recorder: recorder.name,
            recorderId: recorder.id,
            declaredBy: declaredBy.name,
            declaredById: declaredBy.id,
            declaredAt: stamp(declared.declaredAt),
            scheduledAt: stamp(schedule.scheduledAt),
            notes: declared.notes?.trim() || "—",
            scheduleNote: schedule.remark?.trim() || "—",
            transcript: declared.transcriptUrl,
            recordings: declared.links ?? [],
            proof: declared.imageUrls ?? [],
            sort: sortKey(match, schedule.challongeMatchId),
            when: declared.declaredAt.getTime(),
          },
        ];
      })
      .sort((left, right) => compareKeys(left.sort, right.sort) || left.when - right.when)
      .map(({ sort: _sort, when: _when, ...line }) => line);

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
      { kind: "field", label: "Matches stored", value: String(matches.length) },
      { kind: "field", label: "Rooms open", value: String(openRooms) },
      { kind: "field", label: "Rooms closed", value: String(closedRooms) },
      ...(otherRooms > 0 ? [{ kind: "field" as const, label: "Rooms in another state", value: String(otherRooms) }] : []),
      { kind: "field", label: "Schedules", value: String(schedules.length) },
      { kind: "field", label: "Results declared", value: String(results.length) },
      { kind: "field", label: "Attendance marks", value: String(marks.length) },
      { kind: "field", label: "Attendance removed", value: String(Math.max(0, attendanceTotal - marks.length)) },
      { kind: "field", label: "People on the board", value: String(new Set(marks.flatMap((mark) => [mark.judgeId, mark.recorderId])).size) },
    ];

    const work = workLines(marks, names);
    const filename = `${slug(tournament.name)}-report.xlsx`;
    const buffer = await buildTournamentReport({
      tournamentName: tournament.name,
      generatedLabel,
      payModeLabel: mode,
      attendance,
      work,
      results,
      config,
    });

    const icon = guild.iconURL({ extension: "png", size: 256 });
    const heading = `# ${emojis.torneo} Tournament report`;
    const summary = `**${escapeDiscord(tournament.name)}**\nAttendance, staff work, declared results, and the stored setup, in one workbook.`;
    const sheets = [
      `${emojis.judge} **Attendance** — active marks, scores, recordings, and score proof`,
      `${emojis.stats} **Work count** — rounds and games for each seat`,
      `${emojis.scoreboard} **Results** — winner, transcript, notes, and who declared it`,
      `${emojis.settings} **Configuration** — roles, channels, categories, and a snapshot`,
    ].join("\n");
    const counts = [
      `${emojis.judge_recorder} **Attendance:** \`${marks.length}\` active ${marks.length === 1 ? "mark" : "marks"}`,
      `${emojis.stats} **Work:** \`${work.length}\` ${work.length === 1 ? "person" : "people"}`,
      `${emojis.winner} **Results:** \`${results.length}\` declared`,
      `${emojis.calendar} **Generated:** <t:${Math.floor(generatedAt.getTime() / 1000)}:F>`,
    ].join("\n");
    const container = new ContainerBuilder().setAccentColor(ACCENT);
    if (icon) {
      container.addSectionComponents(headingWithThumbnail(heading, icon, summary));
    } else {
      container.addTextDisplayComponents(textBlock(heading), textBlock(summary));
    }
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(sheets))
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(counts))
      .addSeparatorComponents(divider())
      .addFileComponents(attachedFile(filename))
      .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(interaction.user.id)}`));

    await interaction.editReply({
      components: [container],
      files: [new AttachmentBuilder(buffer, { name: filename })],
      flags: v2Flags,
      allowedMentions: { parse: [] },
    });
  } catch {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Report failed", "The workbook could not be built. Try again in a moment.", false),
    );
  }
}
