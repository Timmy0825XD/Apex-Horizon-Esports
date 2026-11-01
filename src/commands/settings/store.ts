import type { GuildSettings } from "@prisma/client";
import { forgetGuildConfig, loadGuildConfig } from "../../lib/guild-config.js";
import { prisma } from "../../lib/prisma.js";
import type { SettingsInput } from "./fields.js";

export async function loadGuildSettings(guildId: string): Promise<GuildSettings | null> {
  return (await loadGuildConfig(guildId)).settings;
}

export async function saveGuildSettings(guildId: string, settings: SettingsInput): Promise<GuildSettings> {
  const guild = await prisma.guild.upsert({
    where: { guildId },
    create: { guildId, settings },
    update: { settings },
    select: { settings: true },
  });
  forgetGuildConfig(guildId);

  if (!guild.settings) {
    throw new Error("Guild settings were not persisted");
  }
  return guild.settings;
}
