import { prisma } from "../../lib/prisma.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";

/** At most this many live schedules can start on the same UTC minute in one server. */
export const MAX_SCHEDULES_PER_MINUTE = 4;
/** A judge or recorder cannot hold two live matches that start less than this apart. */
export const STAFF_GAP_MS = 30 * 60 * 1000;

export interface BookedSchedule {
  id: string;
  channelId: string;
  scheduledAt: Date;
  judgeId: string | null;
  recorderId: string | null;
}

export function sameMinute(left: Date, right: Date): boolean {
  return Math.floor(left.getTime() / 60_000) === Math.floor(right.getTime() / 60_000);
}

export function tooClose(left: Date, right: Date): boolean {
  return Math.abs(left.getTime() - right.getTime()) < STAFF_GAP_MS;
}

/** True when another live schedule cannot be added on that minute. */
export function minuteIsFull(booked: BookedSchedule[], when: Date): boolean {
  return booked.filter((row) => sameMinute(row.scheduledAt, when)).length >= MAX_SCHEDULES_PER_MINUTE;
}

/** The nearest live schedule where `userId` holds a seat less than 30 minutes from `when`. */
export function staffClash(booked: BookedSchedule[], userId: string, when: Date): BookedSchedule | null {
  return (
    booked
      .filter((row) => (row.judgeId === userId || row.recorderId === userId) && tooClose(row.scheduledAt, when))
      .sort((left, right) => Math.abs(left.scheduledAt.getTime() - when.getTime()) - Math.abs(right.scheduledAt.getTime() - when.getTime()))[0] ?? null
  );
}

/**
 * Live schedules of the server that start less than 30 minutes from `when`, other than `excludeId`.
 * Schedules with results or a closed ticket no longer count.
 */
export async function bookedAround(guildId: string, when: Date, excludeId?: string): Promise<BookedSchedule[]> {
  const rows = await prisma.schedule.findMany({
    where: {
      guildId,
      scheduledAt: { gt: new Date(when.getTime() - STAFF_GAP_MS), lt: new Date(when.getTime() + STAFF_GAP_MS) },
      OR: [{ results: null }, { results: { isSet: false } }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, channelId: true, scheduledAt: true, judgeId: true, recorderId: true },
  });
  if (rows.length === 0) {
    return [];
  }
  const closed = await prisma.room.findMany({
    where: { channelId: { in: rows.map((row) => row.channelId) }, status: "closed" },
    select: { channelId: true },
  });
  const closedIds = new Set(closed.map((room) => room.channelId));
  return rows
    .filter((row) => !closedIds.has(row.channelId))
    .map((row) => ({ ...row, judgeId: row.judgeId ?? null, recorderId: row.recorderId ?? null }));
}

function utcLabel(when: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())} UTC · ${pad(when.getUTCDate())}/${pad(when.getUTCMonth() + 1)}/${when.getUTCFullYear()}`;
}

export const fullMinuteTitle = "Time slot full";

export function fullMinuteBody(when: Date): string {
  return `There are already **${MAX_SCHEDULES_PER_MINUTE}** active schedules at \`${utcLabel(when)}\`. Pick another minute.`;
}

export const staffBusyTitle = "Staff already booked";

export function staffBusyBody(userId: string, clash: BookedSchedule): string {
  const unix = Math.floor(clash.scheduledAt.getTime() / 1000);
  return `${formatUser(userId)} already has a match in ${formatChannel(null, clash.channelId)} at <t:${unix}:f>, less than **30 minutes** from this one.`;
}

export function selfBusyBody(clash: BookedSchedule): string {
  const unix = Math.floor(clash.scheduledAt.getTime() / 1000);
  return `You already have a match in ${formatChannel(null, clash.channelId)} at <t:${unix}:f>, less than **30 minutes** from this one.`;
}
