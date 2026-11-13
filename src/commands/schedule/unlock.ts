import type { Client, Guild } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import { ticketChannel } from "./channel.js";
import { syncPosts, thumbnailImageUrl } from "./messages.js";
import { presentFace } from "./store.js";

/** Assign opens disabled and turns on after a random 2–3 s, so a script cannot time the exact moment. */
const UNLOCK_MIN_MS = 2_000;
const UNLOCK_SPREAD_MS = 1_000;

export function unlockDelay(random: () => number = Math.random): number {
  return UNLOCK_MIN_MS + Math.floor(random() * (UNLOCK_SPREAD_MS + 1));
}

/** A too-fast or early click bars that member from this schedule's Assign for this long. */
export const CLAIM_BLOCK_MS = 5 * 60_000;

type ClaimBlock = { userId: string; until: Date };

/** When the member's block on this schedule ends, or null if they are free to claim. */
export function blockedUntil(blocks: ClaimBlock[] | null | undefined, userId: string, now: number): Date | null {
  const active = (blocks ?? []).filter((block) => block.userId === userId && block.until.getTime() > now);
  return active.length ? new Date(Math.max(...active.map((block) => block.until.getTime()))) : null;
}

/** The block list with this member barred for CLAIM_BLOCK_MS from `now`; expired blocks are dropped. */
export function withBlock(blocks: ClaimBlock[] | null | undefined, userId: string, now: number): ClaimBlock[] {
  const kept = (blocks ?? []).filter((block) => block.userId !== userId && block.until.getTime() > now);
  return [...kept, { userId, until: new Date(now + CLAIM_BLOCK_MS) }];
}

export async function blockClaims(scheduleId: string, blocks: ClaimBlock[] | null | undefined, userId: string, now: number): Promise<Date> {
  const next = withBlock(blocks, userId, now);
  await prisma.schedule.update({ where: { id: scheduleId }, data: { claimBlocks: { set: next } } });
  return next[next.length - 1].until;
}

/** Milliseconds between Assign turning on and the click, by Discord's own clock (the interaction ID). */
export function reactionMs(clickedAt: number, unlockAt: Date | null | undefined): number | null {
  return unlockAt ? clickedAt - unlockAt.getTime() : null;
}

/**
 * Call once a claim window was opened (create, refresh, urgent post) and its posts went out disabled.
 * Picks the unlock moment and turns Assign on when it arrives.
 */
export async function armClaimUnlock(guild: Guild, scheduleId: string): Promise<void> {
  const planned = new Date(Date.now() + unlockDelay());
  const armed = await prisma.schedule.updateMany({
    where: { id: scheduleId, claimsOpenUntil: { gt: new Date() } },
    data: { claimsUnlockAt: planned },
  });
  if (armed.count === 1) {
    waitAndUnlock(guild, scheduleId, planned);
  }
}

/** After a restart: arm windows that never got an unlock time and resume the ones still waiting. */
export async function resumeClaimUnlocks(client: Client): Promise<void> {
  const now = new Date();
  const open = await prisma.schedule.findMany({
    where: { claimsOpenUntil: { gt: now } },
    select: { id: true, guildId: true, claimsUnlockAt: true },
  });
  for (const schedule of open) {
    const guild = client.guilds.cache.get(schedule.guildId);
    if (!guild) {
      continue;
    }
    if (!schedule.claimsUnlockAt) {
      await armClaimUnlock(guild, schedule.id).catch((error) => console.error(`Schedule claim arm failed for ${schedule.id}`, error));
    } else if (schedule.claimsUnlockAt > now) {
      waitAndUnlock(guild, schedule.id, schedule.claimsUnlockAt);
    }
  }
}

function waitAndUnlock(guild: Guild, scheduleId: string, planned: Date): void {
  setTimeout(
    () => {
      void unlockClaims(guild, scheduleId, planned).catch((error) => console.error(`Schedule claim unlock failed for ${scheduleId}`, error));
    },
    Math.max(0, planned.getTime() - Date.now()),
  );
}

/**
 * Repaint the posts with Assign on. Then the unlock time moves to the moment the edit landed, so the
 * reaction time counts from when people could actually see the button.
 */
async function unlockClaims(guild: Guild, scheduleId: string, planned: Date): Promise<void> {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  // A newer window (refresh, urgent post) re-armed it: that timer owns the unlock.
  if (!schedule || schedule.claimsUnlockAt?.getTime() !== planned.getTime()) {
    return;
  }
  const [settings, tournament, match, ticket] = await Promise.all([
    loadGuildSettings(guild.id),
    findTournamentById(guild.id, schedule.tournamentId),
    prisma.match.findUnique({
      where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
    }),
    ticketChannel(guild, schedule.channelId),
  ]);
  if (!settings || !tournament || !match || !ticket) {
    return;
  }
  const imageUrl = await thumbnailImageUrl(guild, settings.thumbnailChannelId, schedule.messages.thumbnailMessageId);
  const face = await presentFace(guild, tournament, match, schedule, imageUrl);
  const messages = await syncPosts(guild, ticket, settings.schedulesChannelId, schedule, face);
  await prisma.schedule.updateMany({ where: { id: scheduleId, claimsUnlockAt: planned }, data: { claimsUnlockAt: new Date() } });
  if (
    messages.ticketMessageId !== schedule.messages.ticketMessageId ||
    messages.scheduleChannelMessageId !== schedule.messages.scheduleChannelMessageId
  ) {
    await prisma.schedule.update({ where: { id: scheduleId }, data: { messages } });
  }
}
