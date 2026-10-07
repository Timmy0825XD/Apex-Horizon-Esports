import type { APIMessageComponentEmoji } from "discord.js";

export function customEmoji(raw: string): APIMessageComponentEmoji {
  const match = raw.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) {
    return { name: raw };
  }
  return { id: match[3], name: match[2], animated: raw.startsWith("<a:") };
}

export function emojiAssetUrl(raw: string): string | null {
  const match = raw.match(/^<(a?):[a-zA-Z0-9_]+:(\d+)>$/);
  if (!match?.[2]) {
    return null;
  }
  return `https://cdn.discordapp.com/emojis/${match[2]}.${match[1] === "a" ? "gif" : "png"}`;
}
