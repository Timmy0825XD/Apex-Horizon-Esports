import type { GuildSettings, Schedule } from "@prisma/client";
import type { Guild, TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import type { TournamentRecord } from "../tournament/fields.js";
import type { Match } from "@prisma/client";
import { markTicket } from "./channel.js";
import { createScheduleEvent, syncScheduleEvent } from "./event.js";
import { replaceThumbnail, syncPosts, thumbnailImageUrl, type SchedulePing } from "./messages.js";
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
  ping: SchedulePing = "keep",
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
  const cover = regenerate ? image : undefined;
  if (!eventId) {
    eventId = await createScheduleEvent(guild, face, image).catch((error) => {
      console.error("Schedule event create failed", error);
      return null;
    });
  } else {
    const outcome = await syncScheduleEvent(guild, eventId, face, cover).catch((error) => {
      console.error("Schedule event update failed", error);
      return "synced" as const;
    });
    if ((outcome === "finished" || outcome === "missing") && face.when.getTime() > Date.now()) {
      const created = await createScheduleEvent(guild, face, image).catch((error) => {
        console.error("Schedule event create failed", error);
        return null;
      });
      if (created) {
        eventId = created;
      }
    }
  }
  const messages = await syncPosts(guild, ticket, settings.schedulesChannelId, { ...schedule, messages: { ...schedule.messages, thumbnailMessageId } }, face, ping);
  return prisma.schedule.update({
    where: { id: schedule.id },
    data: { messages, ...(eventId && eventId !== schedule.eventId ? { eventId } : {}) },
  });
}

export async function repaintScheduleChannel(
  guild: Guild,
  ticket: TextChannel,
  settings: GuildSettings,
  tournament: TournamentRecord,
): Promise<void> {
  const schedule = await prisma.schedule.findFirst({ where: { guildId: guild.id, channelId: ticket.id } });
  if (!schedule) {
    return;
  }
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
  if (!match) {
    return;
  }
  await paintSchedule(guild, ticket, settings, tournament, match, schedule, false);
}
