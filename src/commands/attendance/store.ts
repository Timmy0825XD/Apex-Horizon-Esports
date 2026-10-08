import type { Attendance, Match, Prisma, Tournament } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isDefaultWin } from "./payroll.js";

const notDeleted: Prisma.AttendanceWhereInput = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};

export function whereActive(filter: Prisma.AttendanceWhereInput): Prisma.AttendanceWhereInput {
  return { AND: [filter, notDeleted] };
}

export function isObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

export async function findGuildTournament(guildId: string, tournamentId: string): Promise<Tournament | null> {
  if (!isObjectId(tournamentId)) {
    return null;
  }
  return prisma.tournament.findFirst({ where: { id: tournamentId, guildId } }).catch(() => null);
}

export async function findActiveAttendance(
  guildId: string,
  tournamentId: string,
  challongeMatchId: number,
): Promise<Attendance | null> {
  return prisma.attendance.findFirst({
    where: whereActive({ guildId, tournamentId, challongeMatchId }),
  });
}

export async function listActiveAttendance(
  guildId: string,
  tournamentId: string,
  challongeMatchId: number,
): Promise<Attendance[]> {
  return prisma.attendance.findMany({
    where: whereActive({ guildId, tournamentId, challongeMatchId }),
    orderBy: { createdAt: "asc" },
  });
}

export async function findMatchFace(tournamentId: string, challongeMatchId: number): Promise<Match | null> {
  return prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId } },
  });
}

export async function listUserAttendance(guildId: string, tournamentId: string, userId: string): Promise<Attendance[]> {
  return prisma.attendance.findMany({
    where: whereActive({
      guildId,
      tournamentId,
      OR: [{ judgeId: userId }, { recorderId: userId }],
    }),
    orderBy: { createdAt: "desc" },
  });
}

export async function listMissingLinks(guildId: string, tournamentId: string | null, recorderId: string | null): Promise<Attendance[]> {
  const rows = await prisma.attendance.findMany({
    where: whereActive({
      guildId,
      links: { isEmpty: true },
      ...(tournamentId ? { tournamentId } : {}),
      ...(recorderId ? { recorderId } : {}),
    }),
    orderBy: { createdAt: "desc" },
  });
  return rows.filter((row) => !isDefaultWin(row.remark));
}

export async function matchesById(tournamentId: string, ids: number[]): Promise<Map<number, Match>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await prisma.match.findMany({
    where: { tournamentId, challongeMatchId: { in: ids } },
  });
  return new Map(rows.map((row) => [row.challongeMatchId, row]));
}
