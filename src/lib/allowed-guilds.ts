import { env } from "./env.js";

const allowed = new Set(env.allowedGuilds);

export function isAllowedGuild(guildId: string | null | undefined): boolean {
  return guildId != null && allowed.has(guildId);
}
