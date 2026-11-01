import type { GuildSettings, StaffConfig } from "@prisma/client";
import { prisma } from "./prisma.js";

export type GuildConfig = {
  settings: GuildSettings | null;
  staff: StaffConfig | null;
};

// Settings and staff live on the same guild document and are read on almost every interaction.
// Writers call forgetGuildConfig; the TTL covers edits made outside the bot.
const TTL_MS = 60_000;

const cache = new Map<string, { config: GuildConfig; expiresAt: number }>();

export async function loadGuildConfig(guildId: string): Promise<GuildConfig> {
  const hit = cache.get(guildId);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.config;
  }
  const guild = await prisma.guild.findUnique({
    where: { guildId },
    select: { settings: true, staff: true },
  });
  const config = { settings: guild?.settings ?? null, staff: guild?.staff ?? null };
  cache.set(guildId, { config, expiresAt: Date.now() + TTL_MS });
  return config;
}

export function forgetGuildConfig(guildId?: string): void {
  if (guildId) {
    cache.delete(guildId);
    return;
  }
  cache.clear();
}
