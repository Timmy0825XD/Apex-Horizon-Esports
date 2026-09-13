import type { APIMessageComponentEmoji } from "discord.js";

export function customEmoji(raw: string): APIMessageComponentEmoji {
  const match = raw.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) {
    return { name: raw };
  }
  return { id: match[3], name: match[2], animated: raw.startsWith("<a:") };
}
