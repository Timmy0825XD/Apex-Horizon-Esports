import { emojis } from "../../emojis.js";

export function roundLabel(round: number): string {
  if (round < 0) {
    return `Losers ${Math.abs(round)}`;
  }
  return String(round);
}

export function roundTitle(round: number): string {
  return round < 0 ? `Losers Round ${Math.abs(round)}` : `Round ${round}`;
}

export function escapeDiscord(value: string): string {
  return value.replace(/[\\*_~`|]/g, (char) => `\\${char}`);
}

/** `Group B · Round 3`, `Losers Round 1` or just the round when the bracket has no groups. */
export function stageLabel(match: { group: string | null; round: number | null } | null): string | null {
  if (!match || match.round == null) {
    return null;
  }
  const round = roundTitle(match.round);
  return match.group ? `Group ${escapeDiscord(match.group)} · ${round}` : round;
}

/** `**A** \`2\` vs \`1\` **B**` with the winner emoji on the higher score. */
export function scoreLine(leftName: string, rightName: string, team1: number, team2: number): string {
  const left = `**${escapeDiscord(leftName)}**`;
  const right = `**${escapeDiscord(rightName)}**`;
  const leftShown = team1 > team2 ? `${emojis.winner} ${left}` : left;
  const rightShown = team2 > team1 ? `${emojis.winner} ${right}` : right;
  return `${leftShown} \`${team1}\` vs \`${team2}\` ${rightShown}`;
}

export function matchLabel(match: {
  group: string | null;
  round: number;
  leftName: string;
  rightName: string;
}): string {
  const stage = match.group
    ? `Group ${match.group} - Round ${roundLabel(match.round)}`
    : `Round ${roundLabel(match.round)}`;
  return `**${stage}:** ${escapeDiscord(match.leftName)} vs ${escapeDiscord(match.rightName)}`;
}

export function ticketTopic(challongeId: string, matchId: number): string {
  return `Tournament ID: ${escapeDiscord(challongeId)} | Match ID: ${matchId}`;
}
