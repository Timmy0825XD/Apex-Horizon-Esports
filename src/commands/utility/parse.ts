export function parseSnowflakes(input: string): string[] {
  return [...input.matchAll(/\d{17,20}/g)].map((match) => match[0]);
}

export function parseEmojiRef(input: string): { animated: boolean; name: string; id: string } | null {
  const custom = input.match(/<(a?):([a-zA-Z0-9_]+):(\d{17,20})>/);
  if (custom?.[3]) {
    return { animated: custom[1] === "a", name: custom[2] ?? "emoji", id: custom[3] };
  }

  const id = input.match(/\d{17,20}/);
  if (!id?.[0]) {
    return null;
  }
  return { animated: false, name: "emoji", id: id[0] };
}

export function parseDisplayEmoji(
  input: string,
): { kind: "custom"; animated: boolean; name: string; id: string } | { kind: "unicode"; emoji: string } | null {
  const custom = parseEmojiRef(input);
  const trimmed = input.trim();
  if (custom && (/<a?:/.test(trimmed) || /^\d{17,20}$/.test(trimmed))) {
    return { kind: "custom", ...custom };
  }
  if (!trimmed) {
    return null;
  }
  if (custom && trimmed.includes(custom.id)) {
    return { kind: "custom", ...custom };
  }
  return { kind: "unicode", emoji: trimmed };
}

export function customEmojiCdnUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=4096&quality=lossless`;
}

export function twemojiUrl(emoji: string): string {
  const points: string[] = [];
  for (const char of emoji) {
    const code = char.codePointAt(0);
    if (code == null || code === 0xfe0f) {
      continue;
    }
    points.push(code.toString(16));
  }
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${points.join("-")}.png`;
}

export function parseColor(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  const named: Record<string, number> = {
    blurple: 0x5865f2,
    red: 0xed4245,
    green: 0x57f287,
    yellow: 0xfee75c,
    gold: 0xf1c40f,
    orange: 0xe67e22,
    fuchsia: 0xeb459e,
    white: 0xffffff,
    black: 0x000000,
    grey: 0x99aab5,
    gray: 0x99aab5,
    aqua: 0x1abc9c,
    blue: 0x3498db,
  };
  if (trimmed in named) {
    return named[trimmed] ?? null;
  }

  const hex = trimmed.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return Number.parseInt(hex, 16);
  }
  if (/^[0-9a-f]{3}$/.test(hex)) {
    const [r, g, b] = hex.split("");
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }

  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 0xffffff) {
    return numeric;
  }
  return null;
}

export function parseHttpUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function utcDate(year: number, month: number, day: number, hour: number, minute: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  ) {
    return null;
  }
  return date;
}

export function splitChoices(input: string): string[] {
  return input
    .split(/[,|\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const n = Math.min(Math.max(count, 1), pool.length);
  const picked: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) {
      picked.push(item);
    }
  }
  return picked;
}
