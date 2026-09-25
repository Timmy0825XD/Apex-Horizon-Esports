import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "../../lib/prisma.js";

export const BACKGROUND_COUNT = 10;

const backgroundsDir = path.join(process.cwd(), "assets", "backgrounds");

export function backgroundPath(index: number): string {
  const safe = normalizeBackground(index);
  const file = path.join(backgroundsDir, `${safe}.png`);
  if (!existsSync(file)) {
    throw new Error(`Thumbnail background ${safe}.png is missing from assets/backgrounds/.`);
  }
  return file;
}

export function normalizeBackground(index: number): number {
  if (!Number.isInteger(index) || index < 1) {
    return 1;
  }
  return ((index - 1) % BACKGROUND_COUNT) + 1;
}

export async function takeNextBackground(guildId: string): Promise<number> {
  const guild = await prisma.guild.update({
    where: { guildId },
    data: { scheduleBackgroundCursor: { increment: 1 } },
    select: { scheduleBackgroundCursor: true },
  });
  const cursor = guild.scheduleBackgroundCursor;
  if (!Number.isInteger(cursor) || cursor < 1) {
    await prisma.guild.update({
      where: { guildId },
      data: { scheduleBackgroundCursor: 1 },
    });
    return 1;
  }
  return normalizeBackground(cursor);
}
