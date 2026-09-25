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

async function challongeGet(path: string, apiKey: string, timeoutMs: number): Promise<unknown> {
  const joiner = path.includes("?") ? "&" : "?";
  const url = `https://api.challonge.com/v1/${path}${joiner}api_key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ApexHorizonEsportsBot/0.1", Accept: "application/json" },
    });

    if (response.status === 401 || response.status === 422) {
      throw new ChallongeError("bad-key", "Challonge rejected that API key.");
    }
    if (response.status === 404) {
      throw new ChallongeError(
        "not-found",
        "Challonge could not find that tournament. Check the URL or ID and that the key can access it.",
      );
    }
    if (!response.ok) {
      throw new ChallongeError("bad-response", `Challonge returned HTTP \`${response.status}\`. Try again in a moment.`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ChallongeError) {
      throw error;
    }
    throw new ChallongeError("timeout", "Timed out talking to Challonge. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }
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
    const round = typeof match.round === "number" ? match.round : 0;
    return [
      {
        id: matchId,
        state: match.state ?? "pending",
        round,
        groupId: asId(match.group_id),
        player1Id: asId(match.player1_id),
        player2Id: asId(match.player2_id),
        thirdPlace: round > 0 && match.player1_is_prereq_match_loser === true && match.player2_is_prereq_match_loser === true,
      },
    ];
  });

  return {
    state: tournament.state ?? "unknown",
    participants,
    matches,
  };
}
