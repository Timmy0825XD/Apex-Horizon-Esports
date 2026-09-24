export function roundLabel(round: number): string {
  if (round < 0) {
    return `Losers ${Math.abs(round)}`;
  }
  return String(round);
}

export function escapeDiscord(value: string): string {
  return value.replace(/[\\*_~`|]/g, (char) => `\\${char}`);
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
