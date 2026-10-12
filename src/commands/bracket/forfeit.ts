import type { Guild, User } from "discord.js";
import {
  fetchChallongeBracket,
  scoresCsv,
  updateChallongeMatch,
  winnerIdFromScores,
  type ChallongeMatch,
} from "../../lib/challonge.js";
import { decryptSecret } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { auditScoreUpload } from "./audit.js";

export type SettledForfeit = {
  matchId: number;
  leftName: string;
  rightName: string;
  score1: number;
  score2: number;
  winnerName: string;
  winnerId: number;
};

type ForfeitPlan = {
  score1: number;
  score2: number;
  dropSide1: boolean;
  dropSide2: boolean;
};

/** Side 1 stays marked when both arrivals must lose. A single marked side always receives -1. */
export function forfeitPlan(side1Pending: boolean, side2Pending: boolean): ForfeitPlan | null {
  if (side1Pending && side2Pending) {
    return { score1: 0, score2: -1, dropSide1: false, dropSide2: true };
  }
  if (side1Pending) {
    return { score1: -1, score2: 0, dropSide1: true, dropSide2: false };
  }
  if (side2Pending) {
    return { score1: 0, score2: -1, dropSide1: false, dropSide2: true };
  }
  return null;
}

export async function markPendingForfeit(
  guildId: string,
  tournamentId: string,
  participantId: number,
): Promise<void> {
  await prisma.pendingForfeit.upsert({
    where: { tournamentId_participantId: { tournamentId, participantId } },
    create: { guildId, tournamentId, participantId },
    update: {},
  });
}

export async function clearPendingForfeits(tournamentId: string, participantIds: number[]): Promise<void> {
  const ids = [...new Set(participantIds)];
  if (ids.length === 0) {
    return;
  }
  await prisma.pendingForfeit.deleteMany({
    where: { tournamentId, participantId: { in: ids } },
  });
}

async function pendingIds(tournamentId: string): Promise<Set<number>> {
  const rows = await prisma.pendingForfeit.findMany({
    where: { tournamentId },
    select: { participantId: true },
  });
  return new Set(rows.map((row) => row.participantId));
}

function openForfeits(matches: ChallongeMatch[], pending: Set<number>): ChallongeMatch[] {
  return matches
    .filter((match) => {
      if (match.state.toLowerCase() === "complete" || match.player1Id == null || match.player2Id == null) {
        return false;
      }
      if (match.state.toLowerCase() !== "open") {
        return false;
      }
      return pending.has(match.player1Id) || pending.has(match.player2Id);
    })
    .sort((left, right) => left.round - right.round || left.id - right.id);
}

async function syncForfeitRow(
  guildId: string,
  tournamentId: string,
  match: ChallongeMatch,
  leftName: string,
  rightName: string,
): Promise<void> {
  const existing = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId: match.id } },
    select: { group: true },
  });
  await prisma.match.upsert({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId: match.id } },
    create: {
      guildId,
      tournamentId,
      challongeMatchId: match.id,
      state: "complete",
      round: match.round,
      group: existing?.group ?? null,
      player1Name: leftName,
      player2Name: rightName,
    },
    update: {
      state: "complete",
      round: match.round,
      player1Name: leftName,
      player2Name: rightName,
    },
  });
}

export async function settlePendingForfeits(input: {
  guild: Guild;
  tournament: TournamentRecord;
  actor?: User;
}): Promise<SettledForfeit[]> {
  const pending = await pendingIds(input.tournament.id);
  if (pending.size === 0) {
    return [];
  }

  const apiKey = decryptSecret(input.tournament.challongeKeyEnc);
  const settings = input.actor ? await loadGuildSettings(input.guild.id) : null;
  const settled: SettledForfeit[] = [];
  const done = new Set<number>();
  const limit = 32;

  for (let step = 0; step < limit; step += 1) {
    const current = await pendingIds(input.tournament.id);
    if (current.size === 0) {
      break;
    }
    const bracket = await fetchChallongeBracket(input.tournament.challongeId, apiKey);
    const ready = openForfeits(bracket.matches, current).filter((match) => !done.has(match.id));
    if (ready.length === 0) {
      break;
    }

    const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));
    for (const match of ready) {
      if (match.player1Id == null || match.player2Id == null) {
        continue;
      }
      const plan = forfeitPlan(current.has(match.player1Id), current.has(match.player2Id));
      if (!plan) {
        done.add(match.id);
        continue;
      }
      const leftName = names.get(match.player1Id) ?? "Unknown";
      const rightName = names.get(match.player2Id) ?? "Unknown";
      const winnerId = winnerIdFromScores(match.player1Id, match.player2Id, plan.score1, plan.score2);
      const winnerName = names.get(winnerId) ?? "Unknown";
      await updateChallongeMatch(
        input.tournament.challongeId,
        match.id,
        apiKey,
        scoresCsv(plan.score1, plan.score2),
        winnerId,
      );
      await syncForfeitRow(input.guild.id, input.tournament.id, match, leftName, rightName);
      done.add(match.id);
      const drop = [
        plan.dropSide1 ? match.player1Id : null,
        plan.dropSide2 ? match.player2Id : null,
      ].filter((id): id is number => id != null);
      await clearPendingForfeits(input.tournament.id, drop);
      if (plan.dropSide1) {
        current.delete(match.player1Id);
      }
      if (plan.dropSide2) {
        current.delete(match.player2Id);
      }
      settled.push({
        matchId: match.id,
        leftName,
        rightName,
        score1: plan.score1,
        score2: plan.score2,
        winnerName,
        winnerId,
      });
      if (input.actor && settings) {
        await auditScoreUpload({ user: input.actor }, input.guild, settings, {
          action: "forfeited",
          tournamentName: input.tournament.name,
          matchId: match.id,
          leftName,
          rightName,
          score1: plan.score1,
          score2: plan.score2,
          winnerName,
          note: "No battle ticket was opened.",
        }).catch(() => undefined);
      }
    }
  }

  return settled;
}
