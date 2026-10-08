export type PayMode = "per_match" | "per_game";

export const PAY_RATES = {
  per_match: { judge: 450, recorder: 450, dual: 575 },
  per_game: { judge: 325, recorder: 325, dual: 425 },
} as const;

export function payModeForFormat(format: string | null | undefined): PayMode {
  if (format === "4vs4" || format === "5vs5") {
    return "per_game";
  }
  return "per_match";
}

export function payModeLabel(mode: PayMode): string {
  return mode === "per_game" ? "4v4/5v5 (Per Game)" : "1v1/2v2/3v3 (Per Match)";
}

export function isDefaultWin(remark: string | null | undefined): boolean {
  return remark?.trim().toLowerCase() === "dw";
}

export function hasRecordingLink(links: string[]): boolean {
  return links.some((link) => link.trim().length > 0);
}

export type PayRow = {
  judgeId: string;
  recorderId: string;
  team1Score: number;
  team2Score: number;
  links: string[];
  remark: string | null;
};

export type PersonSalary = {
  judge: number;
  recorder: number;
  dual: number;
  total: number;
};

export type CountPerson = {
  userId: string;
  rounds: number;
  matches: number;
};

export type SalaryLine = {
  userId: string;
  category: "judge" | "recorder" | "dual";
  rounds: number;
  games: number;
  gold: number;
};

export function gamesOf(row: Pick<PayRow, "team1Score" | "team2Score">): number {
  return row.team1Score + row.team2Score;
}

function unitOf(mode: PayMode, games: number): number {
  return mode === "per_game" ? games : 1;
}

export function salaryFor(userId: string, rows: PayRow[], mode: PayMode): PersonSalary {
  const rates = PAY_RATES[mode];
  const salary: PersonSalary = { judge: 0, recorder: 0, dual: 0, total: 0 };
  for (const row of rows) {
    const unit = unitOf(mode, gamesOf(row));
    if (row.judgeId === row.recorderId) {
      if (row.judgeId !== userId) {
        continue;
      }
      salary.dual += rates.dual * unit;
      continue;
    }
    if (row.judgeId === userId) {
      salary.judge += rates.judge * unit;
    }
    if (row.recorderId === userId) {
      salary.recorder += rates.recorder * unit;
    }
  }
  salary.total = salary.judge + salary.recorder + salary.dual;
  return salary;
}

export function formatArtCoin(gold: number): string {
  const artCoin = gold / 10;
  return Number.isInteger(artCoin) ? String(artCoin) : artCoin.toFixed(1);
}

function bump(map: Map<string, CountPerson>, userId: string, matches: number): void {
  const current = map.get(userId) ?? { userId, rounds: 0, matches: 0 };
  current.rounds += 1;
  current.matches += matches;
  map.set(userId, current);
}

function ranked(map: Map<string, CountPerson>): CountPerson[] {
  return [...map.values()].sort((a, b) => b.matches - a.matches || b.rounds - a.rounds || a.userId.localeCompare(b.userId));
}

export function workCounts(rows: PayRow[]): { judges: CountPerson[]; recorders: CountPerson[]; duals: CountPerson[] } {
  const judges = new Map<string, CountPerson>();
  const recorders = new Map<string, CountPerson>();
  const duals = new Map<string, CountPerson>();
  for (const row of rows) {
    const matches = gamesOf(row);
    if (row.judgeId !== row.recorderId) {
      bump(judges, row.judgeId, matches);
      bump(recorders, row.recorderId, matches);
      continue;
    }
    bump(duals, row.judgeId, matches);
  }
  return { judges: ranked(judges), recorders: ranked(recorders), duals: ranked(duals) };
}

export function salaryLines(rows: PayRow[], mode: PayMode): SalaryLine[] {
  const rates = PAY_RATES[mode];
  const lines: SalaryLine[] = [];
  for (const row of rows) {
    const games = gamesOf(row);
    const unit = unitOf(mode, games);
    if (row.judgeId === row.recorderId) {
      lines.push({ userId: row.judgeId, category: "dual", rounds: 1, games, gold: rates.dual * unit });
      continue;
    }
    lines.push({ userId: row.judgeId, category: "judge", rounds: 1, games, gold: rates.judge * unit });
    lines.push({ userId: row.recorderId, category: "recorder", rounds: 1, games, gold: rates.recorder * unit });
  }
  return lines;
}
