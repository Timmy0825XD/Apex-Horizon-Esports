import { AttachmentBuilder, type Guild, type Message, type NewsChannel, type TextChannel } from "discord.js";
import type { Schedule, ScheduleMessages } from "@prisma/client";
import { emojis } from "../../emojis.js";
import { formatRole } from "../../lib/formatters.js";
import { loadGuildStaffState } from "../staff/store.js";
import { backgroundPath } from "./backgrounds.js";
import { textChannel } from "./channel.js";
import { claimRow, claimsAreOpen, scheduleEmbed, urgentScheduleEmbed, type ScheduleFace } from "./view.js";

type PostChannel = TextChannel | NewsChannel;

function boardBody(face: ScheduleFace, scheduleId: string, unlocked: boolean) {
  return {
    embeds: [scheduleEmbed(face)],
    components: [claimRow(scheduleId, face.judgeId, face.recorderId, unlocked)],
    allowedMentions: { parse: [] as const },
  };
}

async function upsertBoard(channel: PostChannel, messageId: string | null, face: ScheduleFace, scheduleId: string, unlocked: boolean): Promise<string> {
  const body = boardBody(face, scheduleId, unlocked);
  if (messageId) {
    const existing = await channel.messages.fetch(messageId).catch(() => null);
    if (existing) {
      await existing.edit(body);
      return existing.id;
    }
  }
  const sent = await channel.send(body);
  return sent.id;
}

async function upsertTicket(channel: PostChannel, messageId: string | null, face: ScheduleFace): Promise<string> {
  const body = { embeds: [scheduleEmbed(face)], components: [], allowedMentions: { parse: [] as const } };
  if (messageId) {
    const existing = await channel.messages.fetch(messageId).catch(() => null);
    if (existing) {
      await existing.edit(body);
      return existing.id;
    }
  }
  const sent = await channel.send(body);
  return sent.id;
}

export async function publishThumbnail(guild: Guild, thumbnailChannelId: string, backgroundIndex: number): Promise<Message> {
  const channel = await textChannel(guild, thumbnailChannelId);
  if (!channel) {
    throw new Error("The thumbnail channel is missing or is not a text channel.");
  }
  return channel.send({
    files: [new AttachmentBuilder(backgroundPath(backgroundIndex), { name: `schedule-${backgroundIndex}.png` })],
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
): Promise<ScheduleMessages> {
  const board = await textChannel(guild, schedulesChannelId);
  if (!board) {
    throw new Error("The schedules channel is missing or is not a text channel.");
  }
  const unlocked = claimsAreOpen(schedule.claimsOpenUntil);
  const ticketMessageId = await upsertTicket(ticket, schedule.messages.ticketMessageId, face);
  const scheduleChannelMessageId = await upsertBoard(board, schedule.messages.scheduleChannelMessageId, face, schedule.id, unlocked);
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
  const mentions = roleIds.map((id) => formatRole(guild, id)).join(" ");
  const sent = await board.send({
    content: `${mentions} ${emojis.alert} **URGENT STAFF REPLACEMENT NEEDED!**`.trim(),
    embeds: [urgentScheduleEmbed(face)],
    components: [claimRow(scheduleId, face.judgeId, face.recorderId, true)],
    allowedMentions: { roles: roleIds, parse: [] },
  });
  return sent.id;
}

async function editUrgent(board: PostChannel, messageId: string, face: ScheduleFace, scheduleId: string, unlocked: boolean): Promise<void> {
  const existing = await board.messages.fetch(messageId).catch(() => null);
  if (!existing) {
    return;
  }
  await existing.edit({
    embeds: [urgentScheduleEmbed(face)],
    components: [claimRow(scheduleId, face.judgeId, face.recorderId, unlocked)],
    allowedMentions: { parse: [] },
  });
}

export async function replaceThumbnail(
  guild: Guild,
  thumbnailChannelId: string,
  previousMessageId: string | null | undefined,
  backgroundIndex: number,
): Promise<Message> {
  const channel = await textChannel(guild, thumbnailChannelId);
  if (!channel) {
    throw new Error("The thumbnail channel is missing or is not a text channel.");
  }
  if (previousMessageId) {
    const previous = await channel.messages.fetch(previousMessageId).catch(() => null);
    await previous?.delete().catch(() => undefined);
  }
  return publishThumbnail(guild, thumbnailChannelId, backgroundIndex);
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
