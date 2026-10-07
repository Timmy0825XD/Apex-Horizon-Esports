import type { GuildSettings, Schedule } from "@prisma/client";
import type { Guild, TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import type { TournamentRecord } from "../tournament/fields.js";
import type { Match } from "@prisma/client";
import { markTicket } from "./channel.js";
import { createScheduleEvent, syncScheduleEvent } from "./event.js";
import { replaceThumbnail, syncPosts, thumbnailImageUrl } from "./messages.js";
import { presentFace } from "./store.js";
import { loadThumbnailFace, renderScheduleThumbnail } from "./thumbnail.js";

export async function paintSchedule(
  guild: Guild,
  ticket: TextChannel,
  settings: GuildSettings,
  tournament: TournamentRecord,
  match: Match,
  schedule: Schedule,
  regenerate: boolean,
): Promise<Schedule> {
  let thumbnailMessageId = schedule.messages.thumbnailMessageId;
  let image: Buffer | undefined;
  if (regenerate || !schedule.eventId) {
    const thumbnailFace = await loadThumbnailFace(guild, tournament, match, schedule.scheduledAt);
    image = await renderScheduleThumbnail(thumbnailFace, schedule.backgroundIndex);
  }
  if (regenerate && image) {
    const sent = await replaceThumbnail(guild, settings.thumbnailChannelId, thumbnailMessageId, schedule.backgroundIndex, image);
    thumbnailMessageId = sent.id;
  }
  const imageUrl = await thumbnailImageUrl(guild, settings.thumbnailChannelId, thumbnailMessageId);
  const face = await presentFace(guild, tournament, match, schedule, imageUrl);
  void markTicket(ticket).catch((error) => console.error("Schedule channel mark failed", error));
  let eventId = schedule.eventId;
  if (!eventId) {
    eventId = await createScheduleEvent(guild, face, image).catch((error) => {
      console.error("Schedule event create failed", error);
      return null;
    });
  } else {
    await syncScheduleEvent(guild, eventId, face, regenerate ? image : undefined).catch((error) => {
      console.error("Schedule event update failed", error);
    });
  }
  const messages = await syncPosts(guild, ticket, settings.schedulesChannelId, { ...schedule, messages: { ...schedule.messages, thumbnailMessageId } }, face);
  return prisma.schedule.update({
    where: { id: schedule.id },
    data: { messages, ...(eventId && eventId !== schedule.eventId ? { eventId } : {}) },
  });
}
