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
  const [last, losers] = await Promise.all([
    prisma.match.findFirst({
      where: { tournamentId, group: null, round: { gt: 0 } },
      orderBy: { round: "desc" },
      select: { round: true },
    }),
    prisma.match.findFirst({ where: { tournamentId, group: null, round: { lt: 0 } }, select: { id: true } }),
  ]);
  const lastRound = last?.round ?? null;
  const hasLosers = Boolean(losers);
  if (lastRound != null && match.round === lastRound) {
    return hasLosers ? "GRAND FINAL" : "FINAL";
  }
  if (lastRound != null && !hasLosers && match.round === lastRound - 1) {
    return "SEMIFINAL";
  }
  return `ROUND ${match.round}`;
}
