import { ChannelType, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
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
  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    return "Server settings are not configured yet.";
  }
  const room = await prisma.room.findUnique({ where: { channelId: channel.id } });
  if (!room || room.guildId !== guild.id) {
    return "This channel is not linked to a bracket match.";
  }
  const tournament = await findTournamentById(guild.id, room.tournamentId);
  if (!tournament) {
    return "The tournament for this ticket is no longer registered.";
  }
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: room.tournamentId, challongeMatchId: room.challongeMatchId } },
  });
  if (!match) {
    return "This ticket's match is not stored yet.";
  }
  const schedule = await prisma.schedule.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: room.tournamentId, challongeMatchId: room.challongeMatchId } },
  });
  const { staff } = await loadGuildStaffState(guild.id);
  return { channel, settings, staff, tournament, room, match, schedule };
}
