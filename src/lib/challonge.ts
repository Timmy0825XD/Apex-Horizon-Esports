export type ChallongeTournament = {
  id: number;
  name: string;
  url: string;
  state: string;
};

export type ChallongeParticipant = {
  id: number;
  name: string;
  groupId: number | null;
};

export type ChallongeMatch = {
  id: number;
  state: string;
  round: number;
  groupId: number | null;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  scoresCsv: string | null;
  player1PrereqMatchId: number | null;
  player2PrereqMatchId: number | null;
  /** Both sides arrive as losers of a winners-bracket match: the third place match. */
  thirdPlace: boolean;
};

export type ChallongeBracket = {
  state: string;
  participants: ChallongeParticipant[];
  matches: ChallongeMatch[];
};

export class ChallongeError extends Error {
  constructor(
    readonly code: "bad-key" | "not-found" | "timeout" | "bad-response",
    message: string,
  ) {
    super(message);
    this.name = "ChallongeError";
  }
}

export function normalizeChallongeId(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (!url.hostname.toLowerCase().endsWith("challonge.com")) {
      return trimmed;
    }
    const host = url.hostname.toLowerCase();
    const slug = url.pathname.replace(/^\//, "").split("/").find((part) => part.length > 0);
    if (!slug) {
      return trimmed;
    }
    const sub = host.replace(/\.challonge\.com$/, "");
    if (sub && sub !== "www" && sub !== "challonge.com") {
      return `${sub}-${slug}`;
    }
    return slug;
  } catch {
    return trimmed;
  }
}

async function challongeRequest(
  method: "GET" | "PUT" | "POST",
  path: string,
  apiKey: string,
  timeoutMs: number,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const joiner = path.includes("?") ? "&" : "?";
  const url = `https://api.challonge.com/v1/${path}${joiner}api_key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        "User-Agent": "ApexHorizonEsportsBot/0.1",
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 || response.status === 422) {
      const detail = await response.text().catch(() => "");
      throw new ChallongeError(
        "bad-key",
        detail.includes("score") || detail.includes("winner")
          ? "Challonge rejected that score update. Check the scores and that the match can still be edited."
          : "Challonge rejected that API key.",
      );
    }
    if (response.status === 404) {
      throw new ChallongeError(
        "not-found",
        "Challonge could not find that tournament or match. Check the URL or ID and that the key can access it.",
      );
    }
    if (!response.ok) {
      throw new ChallongeError("bad-response", `Challonge returned HTTP \`${response.status}\`. Try again in a moment.`);
    }

    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof ChallongeError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new ChallongeError("bad-response", "Challonge returned an unexpected payload.");
    }
    throw new ChallongeError("timeout", "Timed out talking to Challonge. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }
}

async function challongeGet(path: string, apiKey: string, timeoutMs: number): Promise<unknown> {
  return challongeRequest("GET", path, apiKey, timeoutMs);
}

export async function fetchChallongeTournament(id: string, apiKey: string): Promise<ChallongeTournament> {
  const body = (await challongeGet(`tournaments/${encodeURIComponent(id)}.json`, apiKey, 12_000)) as {
    tournament?: { id?: number; name?: string; url?: string; state?: string };
  };
  const tournament = body.tournament;
  if (!tournament?.id || !tournament.name || !tournament.url) {
    throw new ChallongeError("bad-response", "Challonge returned an unexpected payload.");
  }

  return {
    id: tournament.id,
    name: tournament.name,
    url: tournament.url,
    state: tournament.state ?? "unknown",
  };
}

type RawParticipant = {
  id?: number;
  name?: string | null;
  group_id?: number | null;
};

type RawMatch = {
  id?: number;
  state?: string;
  round?: number;
  player1_id?: number | null;
  player2_id?: number | null;
  group_id?: number | null;
  winner_id?: number | null;
  scores_csv?: string | null;
  player1_prereq_match_id?: number | null;
  player2_prereq_match_id?: number | null;
  player1_is_prereq_match_loser?: boolean;
  player2_is_prereq_match_loser?: boolean;
};

function unwrap<T extends object>(row: unknown, key: string): T | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const record = row as Record<string, unknown>;
  const nested = record[key];
  if (nested && typeof nested === "object") {
    return nested as T;
  }
  return row as T;
}

function asId(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapMatch(match: RawMatch, matchId: number): ChallongeMatch {
  const round = typeof match.round === "number" ? match.round : 0;
  return {
    id: matchId,
    state: match.state ?? "pending",
    round,
    groupId: asId(match.group_id),
    player1Id: asId(match.player1_id),
    player2Id: asId(match.player2_id),
    winnerId: asId(match.winner_id),
    scoresCsv: match.scores_csv?.trim() || null,
    player1PrereqMatchId: asId(match.player1_prereq_match_id),
    player2PrereqMatchId: asId(match.player2_prereq_match_id),
    thirdPlace: round > 0 && match.player1_is_prereq_match_loser === true && match.player2_is_prereq_match_loser === true,
  };
}

export async function fetchChallongeBracket(id: string, apiKey: string): Promise<ChallongeBracket> {
  const body = (await challongeGet(
    `tournaments/${encodeURIComponent(id)}.json?include_participants=1&include_matches=1`,
    apiKey,
    20_000,
  )) as {
    tournament?: {
      state?: string;
      participants?: unknown[];
      matches?: unknown[];
    };
  };
  const tournament = body.tournament;
  if (!tournament) {
    throw new ChallongeError("bad-response", "Challonge returned an unexpected payload.");
  }

  const participants = (tournament.participants ?? []).flatMap((row) => {
    const participant = unwrap<RawParticipant>(row, "participant");
    const participantId = asId(participant?.id);
    const name = participant?.name?.trim();
    if (!participant || participantId == null || !name) {
      return [];
    }
    return [{ id: participantId, name, groupId: asId(participant.group_id) }];
  });

  const matches = (tournament.matches ?? []).flatMap((row) => {
    const match = unwrap<RawMatch>(row, "match");
    const matchId = asId(match?.id);
    if (!match || matchId == null) {
      return [];
    }
    return [mapMatch(match, matchId)];
  });

  return {
    state: tournament.state ?? "unknown",
    participants,
    matches,
  };
}

export async function updateChallongeMatch(
  tournamentId: string,
  matchId: number,
  apiKey: string,
  scoresCsv: string,
  winnerId: number,
): Promise<ChallongeMatch> {
  const body = (await challongeRequest(
    "PUT",
    `tournaments/${encodeURIComponent(tournamentId)}/matches/${matchId}.json`,
    apiKey,
    20_000,
    { match: { scores_csv: scoresCsv, winner_id: winnerId } },
  )) as { match?: RawMatch };

  const match = unwrap<RawMatch>(body?.match ?? body, "match");
  const id = asId(match?.id) ?? matchId;
  if (!match) {
    throw new ChallongeError("bad-response", "Challonge returned an unexpected match payload.");
  }
  return mapMatch(match, id);
}

export async function reopenChallongeMatch(tournamentId: string, matchId: number, apiKey: string): Promise<void> {
  await challongeRequest(
    "POST",
    `tournaments/${encodeURIComponent(tournamentId)}/matches/${matchId}/reopen.json`,
    apiKey,
    20_000,
  );
}

export function descendantMatchIds(rootId: number, matches: ChallongeMatch[]): number[] {
  const byPrereq = new Map<number, number[]>();
  for (const match of matches) {
    for (const prereq of [match.player1PrereqMatchId, match.player2PrereqMatchId]) {
      if (prereq == null) {
        continue;
      }
      const list = byPrereq.get(prereq) ?? [];
      list.push(match.id);
      byPrereq.set(prereq, list);
    }
  }

  const found: number[] = [];
  const seen = new Set<number>();
  const queue = [...(byPrereq.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id == null || seen.has(id)) {
      continue;
    }
    seen.add(id);
    found.push(id);
    queue.push(...(byPrereq.get(id) ?? []));
  }
  return found;
}

export function winnerIdFromScores(
  player1Id: number,
  player2Id: number,
  score1: number,
  score2: number,
): number {
  if (score1 === score2) {
    throw new ChallongeError("bad-response", "Ties are not allowed on the bracket.");
  }
  return score1 > score2 ? player1Id : player2Id;
}

export function scoresCsv(score1: number, score2: number): string {
  return `${score1}-${score2}`;
}

export function parseScoresCsv(raw: string | null | undefined): { score1: number; score2: number } | null {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(\d+)\s*-\s*(\d+)/);
  if (!match) {
    return null;
  }
  return { score1: Number(match[1]), score2: Number(match[2]) };
}
