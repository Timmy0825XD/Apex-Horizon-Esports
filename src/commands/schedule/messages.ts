import { AttachmentBuilder, MessageFlags, type Guild, type Message, type NewsChannel, type TextChannel } from "discord.js";
import type { Schedule, ScheduleMessages } from "@prisma/client";
import { loadGuildStaffState } from "../staff/store.js";
import { textChannel } from "./channel.js";
import { seatsAreClosed } from "./seat.js";
import { boardPostPayload, claimRow, claimsAreOpen, postMentionIds, ticketPostPayload, urgentPayload, type ScheduleFace } from "./view.js";

type PostChannel = TextChannel | NewsChannel;

export type SchedulePing = "captains" | "staff" | "keep";

type PostBody = ReturnType<typeof ticketPostPayload> & { allowedMentions: { users?: string[]; parse: [] } };

/**
 * Edit a post in place when it is already Components V2. A post from before the V2 redesign (embed)
 * cannot take the V2 layout through an edit, so it is replaced by a new message.
 */
async function sendOrEdit(channel: PostChannel, messageId: string | null, body: PostBody): Promise<string> {
  if (messageId) {
    const existing = await channel.messages.fetch(messageId).catch(() => null);
    if (existing?.flags.has(MessageFlags.IsComponentsV2)) {
      await existing.edit(body);
      return existing.id;
    }
    if (existing) {
      const sent = await channel.send(body);
      await existing.delete().catch(() => undefined);
      return sent.id;
    }
  }
  const sent = await channel.send(body);
  return sent.id;
}

async function upsertBoard(
  channel: PostChannel,
  messageId: string | null,
  face: ScheduleFace,
  scheduleId: string,
  unlocked: boolean,
  openUntil: Date | null,
): Promise<string> {
  const body = {
    ...boardPostPayload({ face, guildId: channel.guild.id, scheduleId, unlocked, openUntil }),
    allowedMentions: { parse: [] as [] },
  };
  return sendOrEdit(channel, messageId, body);
}

/**
 * The ticket post. A ping (captains on create, captains and staff on update) needs a new message,
 * because Discord never notifies mentions added by an edit; the previous post is then removed.
 */
async function upsertTicket(channel: PostChannel, messageId: string | null, face: ScheduleFace, ping: SchedulePing): Promise<string> {
  const users = ping === "keep" ? [] : postMentionIds(face, ping === "staff");
  const shown = ping === "keep" ? postMentionIds(face, true) : users;
  const body = {
    ...ticketPostPayload(face, shown),
    allowedMentions: users.length ? { users, parse: [] as [] } : { parse: [] as [] },
  };
  if (users.length) {
    const sent = await channel.send(body);
    if (messageId) {
      const previous = await channel.messages.fetch(messageId).catch(() => null);
      if (previous && previous.id !== sent.id) {
        await previous.delete().catch(() => undefined);
      }
    }
    return sent.id;
  }
  return sendOrEdit(channel, messageId, body);
}

/** First ticket post of a new schedule: pings only the two captains. */
export async function postTicketSchedule(ticket: TextChannel, face: ScheduleFace): Promise<string> {
  return upsertTicket(ticket, null, face, "captains");
}

/** First schedules-channel post of a new schedule: names the captains without pinging them. */
export async function postBoardSchedule(
  guild: Guild,
  schedulesChannelId: string,
  scheduleId: string,
  face: ScheduleFace,
  openUntil: Date | null,
): Promise<string> {
  const board = await textChannel(guild, schedulesChannelId);
  if (!board) {
    throw new Error("The schedules channel is missing or is not a text channel.");
  }
  return upsertBoard(board, null, face, scheduleId, true, openUntil);
}

export async function publishThumbnail(
  guild: Guild,
  thumbnailChannelId: string,
  backgroundIndex: number,
  image: Buffer,
): Promise<Message> {
  const channel = await textChannel(guild, thumbnailChannelId);
  if (!channel) {
    throw new Error("The thumbnail channel is missing or is not a text channel.");
  }
  return channel.send({
    files: [new AttachmentBuilder(image, { name: `schedule-${backgroundIndex}.jpg` })],
    allowedMentions: { parse: [] },
  });
}

export function attachmentUrl(message: Message): string | undefined {
  return message.attachments.first()?.url;
}

export async function thumbnailImageUrl(guild: Guild, thumbnailChannelId: string, messageId: string | null | undefined): Promise<string | undefined> {
  if (!messageId) {
    return undefined;
  }
  const channel = await textChannel(guild, thumbnailChannelId);
  if (!channel) {
    return undefined;
  }
  const message = await channel.messages.fetch(messageId).catch(() => null);
  return message ? attachmentUrl(message) : undefined;
}

export async function syncPosts(
  guild: Guild,
  ticket: TextChannel,
  schedulesChannelId: string,
  schedule: Schedule,
  face: ScheduleFace,
  ping: SchedulePing = "keep",
  roomStatus?: string,
): Promise<ScheduleMessages> {
  const board = await textChannel(guild, schedulesChannelId);
  if (!board) {
    throw new Error("The schedules channel is missing or is not a text channel.");
  }
  const unlocked = claimsAreOpen(schedule.claimsOpenUntil) && !(await seatsAreClosed(schedule, roomStatus));
  const ticketMessageId = await upsertTicket(ticket, schedule.messages.ticketMessageId, face, ping);
  const scheduleChannelMessageId = await upsertBoard(
    board,
    schedule.messages.scheduleChannelMessageId,
    face,
    schedule.id,
    unlocked,
    schedule.claimsOpenUntil ?? null,
  );
  const messages = { ...schedule.messages, ticketMessageId, scheduleChannelMessageId };
  if (messages.t0MessageId && face.alert) {
    await editUrgent(board, messages.t0MessageId, face, schedule.id, unlocked);
  }
  return messages;
}

export async function publishUrgent(guild: Guild, schedulesChannelId: string, scheduleId: string, face: ScheduleFace): Promise<string> {
  const board = await textChannel(guild, schedulesChannelId);
  if (!board) {
    throw new Error("The schedules channel is missing or is not a text channel.");
  }
  const { staff } = await loadGuildStaffState(guild.id);
  const roleIds: string[] = [];
  if (staff && face.alert) {
    if (face.alert.judgeFailedId || face.alert.judgeVacant) {
      roleIds.push(staff.judgeRoleId);
    }
    if (face.alert.recorderFailedId || face.alert.recorderVacant) {
      roleIds.push(staff.recorderRoleId);
    }
  }
  const sent = await board.send({
    ...urgentPayload({ face, scheduleId, unlocked: true, roleIds }),
    allowedMentions: { roles: roleIds, parse: [] },
  });
  return sent.id;
}

async function editUrgent(board: PostChannel, messageId: string, face: ScheduleFace, scheduleId: string, unlocked: boolean): Promise<void> {
  const existing = await board.messages.fetch(messageId).catch(() => null);
  if (!existing) {
    return;
  }
  // Urgent posts from before the V2 redesign keep their embed; only their buttons are refreshed.
  if (!existing.flags.has(MessageFlags.IsComponentsV2)) {
    await existing.edit({ components: [claimRow(scheduleId, face.judgeId, face.recorderId, unlocked)], allowedMentions: { parse: [] } });
    return;
  }
  const roleIds = existing.mentions.roles.map((role) => role.id);
  await existing.edit({ ...urgentPayload({ face, scheduleId, unlocked, roleIds }), allowedMentions: { parse: [] } });
}

export async function replaceThumbnail(
  guild: Guild,
  thumbnailChannelId: string,
  previousMessageId: string | null | undefined,
  backgroundIndex: number,
  image: Buffer,
): Promise<Message> {
  const channel = await textChannel(guild, thumbnailChannelId);
  if (!channel) {
    throw new Error("The thumbnail channel is missing or is not a text channel.");
  }
  if (previousMessageId) {
    const previous = await channel.messages.fetch(previousMessageId).catch(() => null);
    await previous?.delete().catch(() => undefined);
  }
  return publishThumbnail(guild, thumbnailChannelId, backgroundIndex, image);
}

export async function deleteTracked(guild: Guild, channelId: string | null, messageId: string | null | undefined): Promise<void> {
  if (!channelId || !messageId) {
    return;
  }
  const channel = await textChannel(guild, channelId);
  if (!channel) {
    return;
  }
  const message = await channel.messages.fetch(messageId).catch(() => null);
  await message?.delete().catch(() => undefined);
}

export async function clearScheduleMessages(
  guild: Guild,
  schedule: Schedule,
  schedulesChannelId: string,
  thumbnailChannelId: string,
): Promise<void> {
  await deleteTracked(guild, schedule.channelId, schedule.messages.ticketMessageId);
  await deleteTracked(guild, schedulesChannelId, schedule.messages.scheduleChannelMessageId);
  await deleteTracked(guild, thumbnailChannelId, schedule.messages.thumbnailMessageId);
  await deleteTracked(guild, schedule.channelId, schedule.messages.t10MessageId);
  await deleteTracked(guild, schedulesChannelId, schedule.messages.t0MessageId);
}
