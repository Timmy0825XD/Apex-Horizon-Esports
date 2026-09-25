import type { TextChannel } from "discord.js";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";

export type Seat = "judge" | "recorder";

export function seatAssignedLine(seat: Seat, userId: string): string {
  const label = seat === "judge" ? "Judge" : "Recorder";
  const emoji = seat === "judge" ? emojis.judge : emojis.recorder;
  return `${emoji} ${formatUser(userId)} is set as **${label}** for this match ${emojis.arrive}`;
}

export function seatResignedLine(seat: Seat, userId: string): string {
  const label = seat === "judge" ? "Judge" : "Recorder";
  const emoji = seat === "judge" ? emojis.judge : emojis.recorder;
  return `${emoji} ${formatUser(userId)} resigned as **${label}** for this match ${emojis.resign}`;
}

export async function postSeatLine(channel: TextChannel, line: string, userId: string): Promise<string> {
  const message = await channel.send({
    content: line,
    allowedMentions: { users: [userId], parse: [] },
  });
  return message.id;
}
