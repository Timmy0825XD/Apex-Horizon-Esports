import { prisma } from "../../lib/prisma.js";

export type TeamTournament = {
  id: string;
  name: string;
  sheetLink: string;
};

function objectIdLike(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

export async function listGuildTournaments(guildId: string): Promise<Array<{ id: string; name: string }>> {
  return prisma.tournament.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function findGuildTournament(guildId: string, id: string): Promise<TeamTournament | null> {
  if (!objectIdLike(id)) {
    return null;
  }
  return prisma.tournament.findFirst({
    where: { id, guildId },
    select: { id: true, name: true, sheetLink: true },
  });
}
