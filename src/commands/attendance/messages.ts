import type { Attendance, Match } from "@prisma/client";

type AttendanceTournament = {
  name: string;
  attendanceChannelId: string;
  eventsLinksChannelId: string | null;
};
import type { Guild, Message, TextChannel } from "discord.js";
import { textChannel } from "../schedule/channel.js";
import { v2Flags } from "../../lib/v2.js";
import { eventsLinksText, markedMessage } from "./view.js";

const silent = { allowedMentions: { parse: [] as const } };

export async function postMarkedPair(
  guild: Guild,
  ticket: TextChannel,
  tournament: AttendanceTournament,
  match: Match,
  input: {
    judgeId: string;
    recorderId: string;
    team1Score: number;
    team2Score: number;
    links: string[];
    remark: string | null;
    uploadedBy: string;
    markedAt: Date;
  },
): Promise<{ ticketMessage: Message; attendanceMessage: Message } | string> {
  const attendanceChannel = await textChannel(guild, tournament.attendanceChannelId);
  if (!attendanceChannel) {
    return "The attendance channel for this tournament is not available.";
  }
  const card = markedMessage({
    tournamentName: tournament.name,
    channelId: ticket.id,
    leftName: match.player1Name,
    rightName: match.player2Name,
    ...input,
  });
  const ticketMessage = await ticket.send(card);
  const attendanceMessage = await attendanceChannel.send(card).catch(() => null);
  if (!attendanceMessage) {
    await ticketMessage.delete().catch(() => undefined);
    return "The attendance channel could not be posted to.";
  }
  return { ticketMessage, attendanceMessage };
}

export async function postEventsLinks(
  guild: Guild,
  tournament: AttendanceTournament,
  match: Match,
  team1Score: number,
  team2Score: number,
  links: string[],
): Promise<string | null> {
  if (!tournament.eventsLinksChannelId || links.length === 0) {
    return null;
  }
  const channel = await textChannel(guild, tournament.eventsLinksChannelId);
  if (!channel) {
    return null;
  }
  const message = await channel
    .send({
      content: eventsLinksText({
        leftName: match.player1Name,
        rightName: match.player2Name,
        team1Score,
        team2Score,
        links,
      }),
      ...silent,
    })
    .catch(() => null);
  return message?.id ?? null;
}

export async function deletePosted(messages: Message[]): Promise<void> {
  await Promise.all(messages.map((message) => message.delete().catch(() => undefined)));
}

export async function repaintAttendance(
  guild: Guild,
  tournament: AttendanceTournament,
  match: Match | null,
  attendance: Attendance,
  channelId: string,
): Promise<void> {
  const card = markedMessage({
    tournamentName: tournament.name,
    channelId,
    judgeId: attendance.judgeId,
    recorderId: attendance.recorderId,
    team1Score: attendance.team1Score,
    team2Score: attendance.team2Score,
    leftName: match?.player1Name ?? "Team 1",
    rightName: match?.player2Name ?? "Team 2",
    links: attendance.links,
    remark: attendance.remark,
    uploadedBy: attendance.createdBy,
    markedAt: attendance.createdAt,
  });
  const ticket = await textChannel(guild, channelId);
  const ticketMessage = await ticket?.messages.fetch(attendance.ticketMessageId).catch(() => null);
  const painted = { components: card.components, flags: v2Flags, allowedMentions: card.allowedMentions };
  await ticketMessage?.edit(painted).catch((error) => {
    console.error("Attendance card in the ticket was not updated", error);
  });
  const board = await textChannel(guild, tournament.attendanceChannelId);
  const boardMessage = await board?.messages.fetch(attendance.attendanceChannelMessageId).catch(() => null);
  await boardMessage?.edit(painted).catch((error) => {
    console.error("Attendance card in the attendance channel was not updated", error);
  });
}

export async function clearEventsPosts(guild: Guild, tournament: AttendanceTournament, messageIds: string[]): Promise<void> {
  if (!tournament.eventsLinksChannelId || messageIds.length === 0) {
    return;
  }
  const channel = await textChannel(guild, tournament.eventsLinksChannelId);
  if (!channel) {
    return;
  }
  await Promise.all(messageIds.map((id) => channel.messages.delete(id).catch(() => undefined)));
}
