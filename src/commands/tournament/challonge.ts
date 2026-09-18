export type ChallongeTournament = {
  id: number;
  name: string;
  url: string;
  state: string;
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

export async function fetchChallongeTournament(id: string, apiKey: string): Promise<ChallongeTournament> {
  const url = `https://api.challonge.com/v1/tournaments/${encodeURIComponent(id)}.json?api_key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

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

    const body = (await response.json()) as { tournament?: { id?: number; name?: string; url?: string; state?: string } };
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
  } catch (error) {
    if (error instanceof ChallongeError) {
      throw error;
    }
    throw new ChallongeError("timeout", "Timed out talking to Challonge. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }
}
