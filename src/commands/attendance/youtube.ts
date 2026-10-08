const VIDEO_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

export type LinkRead =
  | { ok: true; links: string[] }
  | { ok: false; reason: "empty" | "invalid" | "too_many" };

export type LinkMerge =
  | { ok: true; added: string[]; links: string[] }
  | { ok: false; reason: "empty" | "invalid" | "duplicate" | "too_many" };

function isYoutubeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (SHORT_HOSTS.has(host)) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return Boolean(id && /^[\w-]{6,}$/.test(id));
  }
  if (!VIDEO_HOSTS.has(host)) {
    return false;
  }
  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v");
    return Boolean(videoId && /^[\w-]{6,}$/.test(videoId));
  }
  const nested = url.pathname.match(/^\/(?:embed|live|shorts)\/([\w-]{6,})\/?$/);
  return Boolean(nested);
}

function uniqueTokens(raw: string): { ok: true; links: string[] } | { ok: false; reason: "invalid" | "too_many" } {
  const tokens = raw.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const links: string[] = [];
  for (const token of tokens) {
    if (!isYoutubeUrl(token)) {
      return { ok: false, reason: "invalid" };
    }
    if (!links.includes(token)) {
      links.push(token);
    }
  }
  if (links.length > 7) {
    return { ok: false, reason: "too_many" };
  }
  return { ok: true, links };
}

export function readYoutubeLinks(raw: string | null, required: boolean): LinkRead {
  const text = raw?.trim() ?? "";
  if (!text) {
    return required ? { ok: false, reason: "empty" } : { ok: true, links: [] };
  }
  return uniqueTokens(text);
}

export function mergeYoutubeLinks(existing: string[], raw: string): LinkMerge {
  const parsed = readYoutubeLinks(raw, true);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.links.some((link) => existing.includes(link))) {
    return { ok: false, reason: "duplicate" };
  }
  if (existing.length + parsed.links.length > 7) {
    return { ok: false, reason: "too_many" };
  }
  return { ok: true, added: parsed.links, links: [...existing, ...parsed.links] };
}
