import { ChannelType, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildStaffState } from "../staff/store.js";
import type { StaffInput } from "../staff/fields.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { findTournamentById } from "../tournament/store.js";
import type { GuildSettings, Match, Room, Schedule } from "@prisma/client";

export type TicketBundle = {
  channel: TextChannel;
  settings: GuildSettings;
  staff: StaffInput | null;
  tournament: TournamentRecord;
  room: Room;
  match: Match;
  schedule: Schedule | null;
};

export async function loadTicket(interaction: ChatInputCommandInteraction): Promise<TicketBundle | string> {
  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !interaction.guildId || !channel || channel.type !== ChannelType.GuildText) {
    return "Run this inside a battle-ticket text channel.";
  }
  const [{ settings, staff }, room] = await Promise.all([
    loadGuildStaffState(guild.id),
    prisma.room.findUnique({ where: { channelId: channel.id } }),
  ]);
  if (!settings) {
    return "Server settings are not configured yet.";
  }
  if (!room || room.guildId !== guild.id) {
    return "This channel is not linked to a bracket match.";
  }
  const key = { tournamentId_challongeMatchId: { tournamentId: room.tournamentId, challongeMatchId: room.challongeMatchId } };
  const [tournament, match, schedule] = await Promise.all([
    findTournamentById(guild.id, room.tournamentId),
    prisma.match.findUnique({ where: key }),
    prisma.schedule.findUnique({ where: key }),
  ]);
  if (!tournament) {
    return "The tournament for this ticket is no longer registered.";
  }
  if (!match) {
    return "This ticket's match is not stored yet.";
  }
  return { channel, settings, staff, tournament, room, match, schedule };
}
