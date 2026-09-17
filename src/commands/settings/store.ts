import type { GuildSettings } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { SettingsInput } from "./fields.js";

export async function loadGuildSettings(guildId: string): Promise<GuildSettings | null> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
    select: { settings: true },
  });
  return guild?.settings ?? null;
}

export async function saveGuildSettings(guildId: string, settings: SettingsInput): Promise<GuildSettings> {
  const guild = await prisma.guild.upsert({
    where: { guildId },
    create: { guildId, settings },
    update: { settings },
    select: { settings: true },
  });

  if (!guild.settings) {
    throw new Error("Guild settings were not persisted");
  }
  return guild.settings;
}
