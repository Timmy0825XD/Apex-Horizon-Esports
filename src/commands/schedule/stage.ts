import type { Match } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type StageMatch = Pick<Match, "round" | "group" | "thirdPlace">;

/**
 * Human label for the bracket stage of a match, as printed on the thumbnail.
 * Group matches never become finals. In the winners bracket the last round is the
 * final (or grand final when a losers bracket exists), the round before it is the
 * semifinal on single elimination, and the third-place match is flagged by Challonge.
 */
export async function resolveStage(tournamentId: string, match: StageMatch): Promise<string> {
  if (match.group) {
    return `GROUP ${match.group} · ROUND ${match.round}`;
  }
  if (match.thirdPlace) {
    return "3RD PLACE";
  }
  if (match.round < 0) {
    return `LOSERS ROUND ${Math.abs(match.round)}`;
  }
  const rows = await prisma.match.findMany({
    where: { tournamentId, group: null },
    select: { round: true },
  });
  const winners = rows.map((row) => row.round).filter((round) => round > 0);
  const lastRound = winners.length > 0 ? Math.max(...winners) : null;
  const hasLosers = rows.some((row) => row.round < 0);
  if (lastRound != null && match.round === lastRound) {
    return hasLosers ? "GRAND FINAL" : "FINAL";
  }
  if (lastRound != null && !hasLosers && match.round === lastRound - 1) {
    return "SEMIFINAL";
  }
  return `ROUND ${match.round}`;
}
