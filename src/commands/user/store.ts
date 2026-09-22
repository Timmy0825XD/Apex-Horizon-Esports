import type { Ban } from "@prisma/client";
import type { Guild, GuildBan } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import type { BanDuration } from "./durations.js";

export async function fetchDiscordBan(guild: Guild, userId: string): Promise<GuildBan | null> {
  return guild.bans.fetch({ user: userId, force: true }).catch(() => null);
}

export function forgetDiscordBan(guild: Guild, userId: string): void {
  guild.bans.cache.delete(userId);
}

export function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

export function flattenReason(reason: string | null | undefined): string | null {
  const text = reason?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

export async function findTrackedBan(guildId: string, userId: string): Promise<Ban | null> {
  try {
    return await prisma.ban.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
  } catch {
    return null;
  }
}

export async function saveTrackedBan(input: {
  guildId: string;
  userId: string;
  duration: BanDuration;
  expiresAt: Date | null;
  reason: string | null;
  createdBy: string;
}): Promise<boolean> {
  try {
    await prisma.ban.upsert({
      where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
      create: {
        guildId: input.guildId,
        userId: input.userId,
        duration: input.duration,
        expiresAt: input.expiresAt,
        reason: input.reason,
        createdBy: input.createdBy,
      },
      update: {
        duration: input.duration,
        expiresAt: input.expiresAt,
        reason: input.reason,
        createdBy: input.createdBy,
        createdAt: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteTrackedBan(guildId: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.ban.deleteMany({
      where: { guildId, userId },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}
