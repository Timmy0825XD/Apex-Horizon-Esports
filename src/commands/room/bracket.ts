import type { ChallongeBracket, ChallongeMatch } from "../../lib/challonge.js";
import { fetchChallongeBracket } from "../../lib/challonge.js";
import { decryptSecret } from "../../lib/crypto.js";
import { playerSlotLabel, type SheetPlayer, type SheetTeam } from "../../lib/sheet.js";
import { prisma } from "../../lib/prisma.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { findTournamentRoster } from "../tournament/store.js";
import { escapeDiscord, matchLabel } from "./labels.js";

export type ReadyMatch = {
  id: number;
  round: number;
  group: string | null;
  leftName: string;
  rightName: string;
  left: SheetTeam;
  right: SheetTeam;
};

export type CaptainIssue = {
  kind: "absent" | "invalid";
  discordId: string | null;
  rawId: string;
  discordTag: string;
  teamName: string;
};

export type BlockedMatch = {
  id: number;
  round: number;
  group: string | null;
  leftName: string;
  rightName: string;
  reason: string;
  sheetMiss: boolean;
  issues: CaptainIssue[];
};

export type TicketQueue = {
  ready: ReadyMatch[];
  blocked: BlockedMatch[];
};

export class TicketQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketQueueError";
  }
}

function normName(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function realSideName(name: string | undefined): string | null {
  if (!name) {
    return null;
  }
  const trimmed = name.trim();
  const folded = trimmed.toLowerCase();
  if (!folded || folded === "tbd" || folded === "bye" || folded === "placeholder") {
    return null;
  }
  if (folded.includes("winner of") || folded.includes("loser of")) {
    return null;
  }
  return trimmed;
}

function groupLetters(matches: ChallongeMatch[]): Map<number, string> {
  const ids = [...new Set(matches.flatMap((match) => (match.groupId == null ? [] : [match.groupId])))].sort(
    (left, right) => left - right,
  );
  return new Map(ids.map((id, index) => [id, index < 26 ? String.fromCharCode(65 + index) : `G${index + 1}`]));
}

export function findTeam(tournament: TournamentRecord, teams: SheetTeam[], challongeName: string): SheetTeam | null {
  const needle = normName(challongeName);
  if (!needle) {
    return null;
  }
  if (tournament.format === "1vs1") {
    return (
      teams.find((team) => normName(captainOf(team)?.discordTag ?? "") === needle) ??
      teams.find((team) => normName(team.teamName) === needle) ??
      null
    );
  }
  return teams.find((team) => normName(team.teamName) === needle) ?? null;
}

export function captainOf(team: SheetTeam): SheetPlayer | null {
  return [...team.players].sort((left, right) => left.slot - right.slot)[0] ?? null;
}

function snowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

function sideFault(
  name: string,
  team: SheetTeam | null,
): { reason: string; issue: CaptainIssue | null; sheetMiss: boolean } | null {
  if (!team) {
    return {
      reason: `**${escapeDiscord(name)}** is not on the stored sheet.`,
      issue: null,
      sheetMiss: true,
    };
  }
  const captain = captainOf(team);
  const teamName = team.teamName.trim() || name;
  const tag = captain?.discordTag.trim() || name;
  const rawId = captain?.discordId.trim() ?? "";
  if (rawId && snowflake(rawId)) {
    return null;
  }
  return {
    reason: rawId
      ? `Captain of **${escapeDiscord(teamName)}** has an invalid Discord ID.`
      : `Captain of **${escapeDiscord(teamName)}** has no Discord ID on the sheet.`,
    issue: { kind: "invalid", discordId: null, rawId, discordTag: tag, teamName },
    sheetMiss: false,
  };
}

function eligibleStage(bracket: ChallongeBracket, match: ChallongeMatch, openHaveGroups: boolean): boolean {
  if (match.state.toLowerCase() !== "open" || match.player1Id == null || match.player2Id == null) {
    return false;
  }
  if (bracket.state === "group_stages_underway") {
    return match.groupId != null || !openHaveGroups;
  }
  if (openHaveGroups) {
    return match.groupId == null;
  }
  return true;
}

export function gameIdLines(team: SheetTeam): string {
  return [...team.players]
    .sort((left, right) => left.slot - right.slot)
    .map((player) => {
      const id = player.gameId.trim();
      return `> **${playerSlotLabel(player.slot)}:** ${id ? `\`${id}\`` : "*Missing*"}`;
    })
    .join("\n");
}

export async function loadTicketQueue(tournament: TournamentRecord): Promise<TicketQueue> {
  let apiKey: string;
  try {
    apiKey = decryptSecret(tournament.challongeKeyEnc);
  } catch {
    throw new TicketQueueError("The stored bracket key could not be read.");
  }

  const roster = await findTournamentRoster(tournament.guildId, tournament.id);
  if (!roster) {
    throw new TicketQueueError("This tournament has no stored roster. Register the sheet again before opening tickets.");
  }

  const bracket = await fetchChallongeBracket(tournament.challongeId, apiKey);
  const letters = groupLetters(bracket.matches);
  const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));
  const rooms = await prisma.room.findMany({
    where: { tournamentId: tournament.id },
    select: { challongeMatchId: true },
  });
  const taken = new Set(rooms.map((room) => room.challongeMatchId));

  await Promise.all(
    bracket.matches.map((match) => {
      const group = match.groupId == null ? null : (letters.get(match.groupId) ?? null);
      const player1Name = names.get(match.player1Id ?? -1) ?? "";
      const player2Name = names.get(match.player2Id ?? -1) ?? "";
      return prisma.match.upsert({
        where: {
          tournamentId_challongeMatchId: {
            tournamentId: tournament.id,
            challongeMatchId: match.id,
          },
        },
        create: {
          guildId: tournament.guildId,
          tournamentId: tournament.id,
          challongeMatchId: match.id,
          state: match.state,
          round: match.round,
          group,
          player1Name,
          player2Name,
        },
        update: {
          state: match.state,
          round: match.round,
          group,
          player1Name,
          player2Name,
        },
      });
    }),
  );

  const ready: ReadyMatch[] = [];
  const blocked: BlockedMatch[] = [];
  const openHaveGroups = bracket.matches.some(
    (match) =>
      match.state.toLowerCase() === "open" && match.groupId != null && match.player1Id != null && match.player2Id != null,
  );

  for (const match of bracket.matches) {
    if (!eligibleStage(bracket, match, openHaveGroups) || taken.has(match.id)) {
      continue;
    }
    const leftName = realSideName(names.get(match.player1Id ?? -1));
    const rightName = realSideName(names.get(match.player2Id ?? -1));
    if (!leftName || !rightName) {
      continue;
    }
    const group = match.groupId == null ? null : (letters.get(match.groupId) ?? null);
    const left = findTeam(tournament, roster, leftName);
    const right = findTeam(tournament, roster, rightName);
    const faults = [sideFault(leftName, left), sideFault(rightName, right)].filter(
      (fault): fault is NonNullable<ReturnType<typeof sideFault>> => Boolean(fault),
    );
    if (faults.length > 0 || !left || !right) {
      blocked.push({
        id: match.id,
        round: match.round,
        group,
        leftName,
        rightName,
        reason: faults.map((fault) => fault.reason).join(" "),
        sheetMiss: faults.some((fault) => fault.sheetMiss) || !left || !right,
        issues: faults.flatMap((fault) => (fault.issue ? [fault.issue] : [])),
      });
      continue;
    }
    ready.push({ id: match.id, round: match.round, group, leftName, rightName, left, right });
  }

  return { ready, blocked };
}

export function blockedLine(match: BlockedMatch): string {
  return `> ${matchLabel(match)}\n> ${match.reason}`;
}
