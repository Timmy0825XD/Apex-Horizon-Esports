import type { Prisma } from "@prisma/client";
import { ContainerBuilder, type TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";
import { textBlock, v2Flags } from "../../lib/v2.js";
import { toneColor } from "./respond.js";

export type Seat = "judge" | "recorder";

/** Filter: the seat is held by `userId`, or is vacant when `userId` is null (null or never set). */
export function seatHeldBy(seat: Seat, userId: string | null): Prisma.ScheduleWhereInput {
  if (userId) {
    return seat === "judge" ? { judgeId: userId } : { recorderId: userId };
  }
  return seat === "judge"
    ? { OR: [{ judgeId: null }, { judgeId: { isSet: false } }] }
    : { OR: [{ recorderId: null }, { recorderId: { isSet: false } }] };
}

/** Write one seat and its own confirmation flag without touching the other seat. */
export function seatWrite(seat: Seat, userId: string | null, confirmed: boolean): Prisma.ScheduleUpdateManyMutationInput {
  return seat === "judge"
    ? { judgeId: userId, confirmations: { update: { judge: confirmed } } }
    : { recorderId: userId, confirmations: { update: { recorder: confirmed } } };
}

export const closedSeatTitle = "Match concluded";

export const closedSeatBody =
  "This match already has results or the ticket is closed, so no one can take the **judge** or **recorder** seat.";

/** Pass roomStatus when the caller already loaded the ticket's room. */
export async function seatsAreClosed(schedule: { results: unknown; channelId: string }, roomStatus?: string): Promise<boolean> {
  if (schedule.results) {
    return true;
  }
  if (roomStatus !== undefined) {
    return roomStatus === "closed";
  }
  const room = await prisma.room.findUnique({
    where: { channelId: schedule.channelId },
    select: { status: true },
  });
  return room?.status === "closed";
}

export function seatAssignedLine(seat: Seat, userId: string): string {
  const label = seat === "judge" ? "Judge" : "Recorder";
  const emoji = seat === "judge" ? emojis.judge : emojis.recorder;
  return `${emoji} ${formatUser(userId)} is set as **${label}** for this match ${emojis.arrive}`;
}

/** The seat was released because the new time clashes with another match the same member holds. */
export function seatClashLine(seat: Seat, userId: string): string {
  const label = seat === "judge" ? "Judge" : "Recorder";
  const emoji = seat === "judge" ? emojis.judge : emojis.recorder;
  return `${emoji} ${formatUser(userId)} was removed as **${label}** for this match: the new time clashes with another match they hold ${emojis.resign}`;
}

/** One line when the same member takes both seats. */
export function bothSeatsAssignedLine(userId: string): string {
  return `${emojis.judge_recorder} ${formatUser(userId)} is set as **Judge** and **Recorder** for this match ${emojis.arrive}`;
}

export function seatResignedLine(seat: Seat, userId: string): string {
  const label = seat === "judge" ? "Judge" : "Recorder";
  const emoji = seat === "judge" ? emojis.judge : emojis.recorder;
  return `${emoji} ${formatUser(userId)} resigned as **${label}** for this match ${emojis.resign}`;
}

/**
 * Posts a seat notice in the ticket as a one-line Components V2: green when someone takes a seat,
 * orange when a seat is left. The member is pinged.
 */
export async function postSeatLine(channel: TextChannel, line: string, userId: string, tone: "success" | "warning" = "success"): Promise<string> {
  const message = await channel.send({
    components: [new ContainerBuilder().setAccentColor(toneColor[tone]).addTextDisplayComponents(textBlock(line))],
    flags: v2Flags,
    allowedMentions: { users: [userId], parse: [] },
  });
  return message.id;
}
