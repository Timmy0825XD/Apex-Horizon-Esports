import { readFile } from "node:fs/promises";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, type Guild } from "discord.js";
import { emojis } from "../../emojis.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { roundLabel } from "../room/labels.js";
import { backgroundPath } from "./backgrounds.js";
import type { ScheduleFace } from "./view.js";

const MATCH_MINUTES = 30;

function eventName(face: ScheduleFace): string {
  return `${face.leftName} vs ${face.rightName}`.slice(0, 100);
}

function eventDescription(face: ScheduleFace): string {
  const unix = Math.floor(face.when.getTime() / 1000);
  const lines = [`${emojis.torneo} **Tournament:** ${face.tournamentName}`];
  if (face.group) {
    lines.push(`${emojis.challonge} **Group:** ${face.group}`);
  }
  lines.push(
    `${emojis.challonge} **Round:** ${roundLabel(face.round)}`,
    `${emojis.calendar} <t:${unix}:F> (<t:${unix}:R>)`,
    `${emojis.textChannel} **Channel:** ${formatChannel(null, face.channelId)}`,
    `**Team-1:** ${face.captain1Id ? formatUser(face.captain1Id) : ""}`,
    `**Team-2:** ${face.captain2Id ? formatUser(face.captain2Id) : ""}`,
    "**Staff:**",
    `${emojis.judge} **Judge:** ${face.judgeId ? formatUser(face.judgeId) : ""}`,
    `${emojis.recorder} **Recorder:** ${face.recorderId ? formatUser(face.recorderId) : ""}`,
  );
  return lines.join("\n").slice(0, 1000);
}

function eventTimes(when: Date): { scheduledStartTime: Date; scheduledEndTime: Date } {
  return {
    scheduledStartTime: when,
    scheduledEndTime: new Date(when.getTime() + MATCH_MINUTES * 60 * 1000),
  };
}

export async function createScheduleEvent(guild: Guild, face: ScheduleFace, backgroundIndex?: number): Promise<string> {
  const event = await guild.scheduledEvents.create({
    name: eventName(face),
    ...eventTimes(face.when),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    entityMetadata: { location: guild.name.slice(0, 100) },
    description: eventDescription(face),
    ...(backgroundIndex == null ? {} : { image: await readFile(backgroundPath(backgroundIndex)) }),
  });
  return event.id;
}

export async function syncScheduleEvent(guild: Guild, eventId: string, face: ScheduleFace, backgroundIndex?: number): Promise<void> {
  const event = await guild.scheduledEvents.fetch(eventId).catch(() => null);
  if (!event) {
    return;
  }
  await event.edit({
    name: eventName(face),
    ...eventTimes(face.when),
    entityMetadata: { location: guild.name.slice(0, 100) },
    description: eventDescription(face),
    ...(backgroundIndex == null ? {} : { image: await readFile(backgroundPath(backgroundIndex)) }),
  });
}

export async function deleteScheduleEvent(guild: Guild, eventId: string | null | undefined): Promise<void> {
  if (!eventId) {
    return;
  }
  await guild.scheduledEvents.delete(eventId).catch(() => undefined);
}
