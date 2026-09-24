import type { Prisma, Tournament as TournamentRow } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isTeamFormat, type TeamFormat, type TournamentRecord, type TournamentWorld } from "./fields.js";
import type { ParsedSheet, ExtraField, SheetTeam } from "./sheet.js";

export const MAX_ACTIVE_TOURNAMENTS = 4;

export const SHEET_ORIGIN = {
  tournament: "tournament",
  manual: "manual",
  historical: "historical",
} as const;

export type SheetOrigin = (typeof SHEET_ORIGIN)[keyof typeof SHEET_ORIGIN];

export type StoredSheetRecord = {
  id: string;
  guildId: string;
  guildName: string;
  sheetLink: string;
  format: TeamFormat;
  additionalFieldCount: number;
  origin: SheetOrigin;
  tournamentId: string | null;
  tournamentName: string | null;
  headers: string[];
  teams: SheetTeam[];
};

export function objectIdLike(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function asExtra(value: unknown): ExtraField[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return [];
    }
    if (typeof row.header !== "string" || typeof row.value !== "string") {
      return [];
    }
    return [{ header: row.header, value: row.value }];
  });
}

function asTeams(value: Prisma.JsonValue): SheetTeam[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || !Array.isArray(row.players)) {
      return [];
    }
    const players = row.players.flatMap((player) => {
      if (!player || typeof player !== "object" || Array.isArray(player)) {
        return [];
      }
      if (
        typeof player.slot !== "number" ||
        typeof player.discordTag !== "string" ||
        typeof player.discordId !== "string" ||
        typeof player.gameName !== "string" ||
        typeof player.gameId !== "string"
      ) {
        return [];
      }
      return [
        {
          slot: player.slot,
          discordTag: player.discordTag,
          discordId: player.discordId,
          gameName: player.gameName,
          gameId: player.gameId,
          currentTitle: typeof player.currentTitle === "string" ? player.currentTitle : "",
        },
      ];
    });
    if (players.length === 0) {
      return [];
    }
    const captain = players[0];
    const teamName = typeof row.teamName === "string" && row.teamName.length > 0 ? row.teamName : (captain?.discordTag ?? "");
    return [{ teamName, players, extra: asExtra(row.extra) }];
  });
}

function toRecord(row: TournamentRow): TournamentRecord {
  const format = isTeamFormat(row.format) ? row.format : "1vs1";
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    challongeId: row.challongeId,
    challongeKeyEnc: row.challongeKeyEnc,
    sheetLink: row.sheetLink,
    format,
    additionalFieldCount: row.additionalFieldCount,
    adminRoleId: row.adminRoleId,
    helperRoleId: row.helperRoleId,
    attendanceChannelId: row.attendanceChannelId,
    transcriptChannelId: row.transcriptChannelId,
    rulesChannelId: row.rulesChannelId,
    deadlineChannelId: row.deadlineChannelId,
    resultChannelId: row.resultChannelId,
    eventsLinksChannelId: row.eventsLinksChannelId,
    closedTicketCategoryId: row.closedTicketCategoryId,
    closeTicketCategory2Id: row.closeTicketCategory2Id,
    ticketOpenCategoryIds: row.ticketOpenCategoryIds,
    autoRoomCapable: row.autoRoomCapable,
    autoRoomRunning: row.autoRoomRunning,
    createdBy: row.createdBy,
  };
}

export async function countTournaments(guildId: string): Promise<number> {
  return prisma.tournament.count({ where: { guildId } });
}

export async function listTournaments(guildId: string): Promise<TournamentRecord[]> {
  const rows = await prisma.tournament.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
  });
  return rows.map(toRecord);
}

export async function findTournamentById(guildId: string, id: string): Promise<TournamentRecord | null> {
  if (!objectIdLike(id)) {
    return null;
  }
  const row = await prisma.tournament.findFirst({ where: { id, guildId } });
  return row ? toRecord(row) : null;
}

export async function findTournamentByChallongeId(
  guildId: string,
  challongeId: string,
): Promise<TournamentRecord | null> {
  const row = await prisma.tournament.findFirst({ where: { guildId, challongeId } });
  return row ? toRecord(row) : null;
}

export async function findTournamentByName(guildId: string, name: string): Promise<TournamentRecord | null> {
  const row = await prisma.tournament.findFirst({ where: { guildId, name } });
  return row ? toRecord(row) : null;
}

export async function setAutoRoomRunning(id: string, running: boolean): Promise<TournamentRecord> {
  const row = await prisma.tournament.update({
    where: { id },
    data: { autoRoomRunning: running },
  });
  return toRecord(row);
}

export async function listRunningAutoRooms(): Promise<TournamentRecord[]> {
  const rows = await prisma.tournament.findMany({ where: { autoRoomRunning: true } });
  return rows.map(toRecord);
}

export async function createTournament(
  guildId: string,
  world: TournamentWorld,
  challongeKeyEnc: string,
  createdBy: string,
): Promise<TournamentRecord> {
  const row = await prisma.tournament.create({
    data: {
      guildId,
      name: world.name,
      challongeId: world.challongeId,
      challongeKeyEnc,
      sheetLink: world.sheetLink,
      format: world.format,
      additionalFieldCount: world.additionalFieldCount,
      adminRoleId: world.adminRoleId,
      helperRoleId: world.helperRoleId,
      attendanceChannelId: world.attendanceChannelId,
      transcriptChannelId: world.transcriptChannelId,
      rulesChannelId: world.rulesChannelId,
      deadlineChannelId: world.deadlineChannelId,
      resultChannelId: world.resultChannelId,
      eventsLinksChannelId: world.eventsLinksChannelId,
      closedTicketCategoryId: world.closedTicketCategoryId,
      closeTicketCategory2Id: world.closeTicketCategory2Id,
      ticketOpenCategoryIds: world.ticketOpenCategoryIds,
      autoRoomCapable: world.autoRoomCapable,
      autoRoomRunning: false,
      createdBy,
    },
  });
  return toRecord(row);
}

export async function updateTournament(
  id: string,
  world: TournamentWorld,
  challongeKeyEnc: string,
): Promise<TournamentRecord> {
  const row = await prisma.tournament.update({
    where: { id },
    data: {
      name: world.name,
      sheetLink: world.sheetLink,
      format: world.format,
      additionalFieldCount: world.additionalFieldCount,
      challongeKeyEnc,
      adminRoleId: world.adminRoleId,
      helperRoleId: world.helperRoleId,
      attendanceChannelId: world.attendanceChannelId,
      transcriptChannelId: world.transcriptChannelId,
      rulesChannelId: world.rulesChannelId,
      deadlineChannelId: world.deadlineChannelId,
      resultChannelId: world.resultChannelId,
      eventsLinksChannelId: world.eventsLinksChannelId,
      closedTicketCategoryId: world.closedTicketCategoryId,
      closeTicketCategory2Id: world.closeTicketCategory2Id,
      ticketOpenCategoryIds: world.ticketOpenCategoryIds,
      autoRoomCapable: world.autoRoomCapable,
      autoRoomRunning: world.autoRoomRunning,
    },
  });
  return toRecord(row);
}

export type DeletedRelated = {
  matches: number;
  rooms: number;
  schedules: number;
  attendances: number;
};

export async function deleteTournamentWorld(guildId: string, tournamentId: string): Promise<DeletedRelated> {
  const [matches, rooms, schedules, attendances] = await Promise.all([
    prisma.match.deleteMany({ where: { guildId, tournamentId } }),
    prisma.room.deleteMany({ where: { guildId, tournamentId } }),
    prisma.schedule.deleteMany({ where: { guildId, tournamentId } }),
    prisma.attendance.deleteMany({ where: { guildId, tournamentId } }),
  ]);

  await prisma.storedSheet.updateMany({
    where: { guildId, tournamentId, origin: SHEET_ORIGIN.tournament },
    data: { origin: SHEET_ORIGIN.historical },
  });

  await prisma.tournament.delete({ where: { id: tournamentId } });

  return {
    matches: matches.count,
    rooms: rooms.count,
    schedules: schedules.count,
    attendances: attendances.count,
  };
}

function toStoredSheet(row: {
  id: string;
  guildId: string;
  guildName: string;
  sheetLink: string;
  format: string;
  additionalFieldCount: number;
  origin: string;
  tournamentId: string | null;
  tournamentName: string | null;
  headers: string[];
  teams: Prisma.JsonValue;
}): StoredSheetRecord | null {
  if (!isTeamFormat(row.format)) {
    return null;
  }
  const origin =
    row.origin === SHEET_ORIGIN.manual || row.origin === SHEET_ORIGIN.historical || row.origin === SHEET_ORIGIN.tournament
      ? row.origin
      : null;
  if (!origin) {
    return null;
  }
  return {
    id: row.id,
    guildId: row.guildId,
    guildName: row.guildName || "",
    sheetLink: row.sheetLink,
    format: row.format,
    additionalFieldCount: row.additionalFieldCount,
    origin,
    tournamentId: row.tournamentId,
    tournamentName: row.tournamentName,
    headers: row.headers,
    teams: asTeams(row.teams),
  };
}

export async function saveTournamentSheet(
  guildId: string,
  guildName: string,
  tournament: { id: string; name: string; sheetLink: string },
  parsed: ParsedSheet,
): Promise<void> {
  const existing = await prisma.storedSheet.findFirst({
    where: { guildId, tournamentId: tournament.id, origin: SHEET_ORIGIN.tournament },
  });

  const data = {
    guildName,
    sheetLink: tournament.sheetLink,
    format: parsed.format,
    additionalFieldCount: parsed.additionalFieldCount,
    origin: SHEET_ORIGIN.tournament,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    headers: parsed.headers,
    teams: parsed.teams as Prisma.InputJsonValue,
  };

  if (existing) {
    await prisma.storedSheet.update({ where: { id: existing.id }, data });
    return;
  }

  await prisma.storedSheet.create({
    data: { guildId, ...data },
  });
}

export async function renameTournamentSheets(guildId: string, tournamentId: string, name: string): Promise<void> {
  await prisma.storedSheet.updateMany({
    where: { guildId, tournamentId, origin: SHEET_ORIGIN.tournament },
    data: { tournamentName: name },
  });
}

export async function createManualSheet(
  guildId: string,
  guildName: string,
  sheetLink: string,
  tournamentName: string,
  parsed: ParsedSheet,
): Promise<StoredSheetRecord> {
  const row = await prisma.storedSheet.create({
    data: {
      guildId,
      guildName,
      sheetLink,
      format: parsed.format,
      additionalFieldCount: parsed.additionalFieldCount,
      origin: SHEET_ORIGIN.manual,
      tournamentId: null,
      tournamentName,
      headers: parsed.headers,
      teams: parsed.teams as Prisma.InputJsonValue,
    },
  });
  return toStoredSheet(row) as StoredSheetRecord;
}

export async function findTournamentSheetHeaders(guildId: string, tournamentId: string): Promise<string[] | null> {
  const row = await prisma.storedSheet.findFirst({
    where: { guildId, tournamentId, origin: SHEET_ORIGIN.tournament },
    select: { headers: true },
  });
  return row?.headers ?? null;
}

export async function findTournamentRoster(guildId: string, tournamentId: string): Promise<SheetTeam[] | null> {
  const row = await prisma.storedSheet.findFirst({
    where: { guildId, tournamentId, origin: SHEET_ORIGIN.tournament },
    select: { teams: true },
  });
  return row ? asTeams(row.teams) : null;
}

export async function findStoredSheetByLink(sheetLink: string): Promise<StoredSheetRecord | null> {
  const row = await prisma.storedSheet.findFirst({ where: { sheetLink } });
  return row ? toStoredSheet(row) : null;
}

export type StoredSheetSummary = {
  id: string;
  guildId: string;
  guildName: string;
  sheetLink: string;
  format: TeamFormat;
  origin: SheetOrigin;
  tournamentName: string | null;
};

function toSummary(row: {
  id: string;
  guildId: string;
  guildName: string;
  sheetLink: string;
  format: string;
  origin: string;
  tournamentName: string | null;
}): StoredSheetSummary | null {
  if (!isTeamFormat(row.format)) {
    return null;
  }
  const origin =
    row.origin === SHEET_ORIGIN.manual || row.origin === SHEET_ORIGIN.historical || row.origin === SHEET_ORIGIN.tournament
      ? row.origin
      : null;
  if (!origin) {
    return null;
  }
  return {
    id: row.id,
    guildId: row.guildId,
    guildName: row.guildName || "",
    sheetLink: row.sheetLink,
    format: row.format,
    origin,
    tournamentName: row.tournamentName,
  };
}

export async function listStoredSheetSummaries(): Promise<StoredSheetSummary[]> {
  const rows = await prisma.storedSheet.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      guildId: true,
      guildName: true,
      sheetLink: true,
      format: true,
      origin: true,
      tournamentName: true,
    },
  });
  return rows.flatMap((row) => {
    const parsed = toSummary(row);
    return parsed ? [parsed] : [];
  });
}

export async function findStoredSheetById(id: string): Promise<StoredSheetSummary | null> {
  if (!objectIdLike(id)) {
    return null;
  }
  const row = await prisma.storedSheet.findUnique({
    where: { id },
    select: {
      id: true,
      guildId: true,
      guildName: true,
      sheetLink: true,
      format: true,
      origin: true,
      tournamentName: true,
    },
  });
  return row ? toSummary(row) : null;
}

export async function findStoredSheetsByName(query: string): Promise<StoredSheetSummary[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const sheets = await listStoredSheetSummaries();
  const named = sheets.filter((sheet) => (sheet.tournamentName ?? "").toLowerCase() === needle);
  if (named.length > 0) {
    return named;
  }
  return sheets.filter((sheet) => (sheet.tournamentName ?? "").toLowerCase().includes(needle));
}

export async function listStoredSheets(): Promise<StoredSheetRecord[]> {
  const rows = await prisma.storedSheet.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.flatMap((row) => {
    const parsed = toStoredSheet(row);
    return parsed ? [parsed] : [];
  });
}
