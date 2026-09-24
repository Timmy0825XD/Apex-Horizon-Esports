import { ChannelType, MessageFlags, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { prisma } from "../../lib/prisma.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { deferRoom, respondRoom } from "../room/respond.js";
import { categoryMention, roomPanel } from "../room/view.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import { auditTicket } from "./audit.js";
import { closeTicket, deleteTicket, reopenTicket } from "./lifecycle.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleTicketSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !interaction.guildId || !channel || channel.type !== ChannelType.GuildText) {
    await respondRoom(
      interaction,
      roomPanel("error", "Not a battle ticket", ["Run this inside a battle-ticket text channel."]),
    );
    return;
  }

  if (!(await memberIsOrganiser(interaction))) {
    await respondRoom(
      interaction,
      roomPanel("error", "Organiser required", [
        "Only an **Organiser** (manager role) or a Discord **Administrator** can change a battle ticket.",
      ]),
    );
    return;
  }

  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    await respondRoom(
      interaction,
      roomPanel("error", "Settings not configured", [
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first.`,
      ]),
    );
    return;
  }

  const room = await prisma.room.findUnique({ where: { channelId: channel.id } });
  if (!room || room.guildId !== guild.id) {
    await respondRoom(
      interaction,
      roomPanel("error", "Not a battle ticket", ["This channel is not linked to a bracket match."]),
    );
    return;
  }

  const tournament = await findTournamentById(guild.id, room.tournamentId);
  if (!tournament) {
    await respondRoom(
      interaction,
      roomPanel("error", "Tournament missing", ["The tournament for this ticket is no longer registered."]),
    );
    return;
  }

  const sub = interaction.options.getSubcommand();
  await deferRoom(interaction);

  try {
    if (sub === "close") {
      await closeCurrent(interaction, channel, guild, tournament, room.status, settings, room.challongeMatchId);
      return;
    }
    if (sub === "reopen") {
      await reopenCurrent(
        interaction,
        channel,
        guild,
        tournament,
        room.status,
        room.categoryId,
        settings,
        room.challongeMatchId,
      );
      return;
    }
    if (sub === "delete") {
      await deleteCurrent(interaction, channel, guild, tournament.name, room.id, settings, room.challongeMatchId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "That ticket action could not be finished.";
    await respondRoom(interaction, roomPanel("error", "Ticket action failed", [message]));
  }
}

async function closeCurrent(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel,
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  tournament: NonNullable<Awaited<ReturnType<typeof findTournamentById>>>,
  status: string,
  settings: NonNullable<Awaited<ReturnType<typeof loadGuildSettings>>>,
  matchId: number,
): Promise<void> {
  if (status === "closed") {
    await respondRoom(
      interaction,
      roomPanel("info", "Ticket already closed", ["This battle ticket is already silenced in a closed category."]),
    );
    return;
  }
  const categoryId = await closeTicket(channel, guild, tournament);
  await respondRoom(
    interaction,
    roomPanel("success", "Ticket closed", [
      `This battle ticket is silenced and now sits in ${categoryMention(guild, categoryId)}.`,
      "Chat access can be restored by reopening it.",
    ]),
  );
  await auditTicket(interaction, guild, settings, "closed", channel.id, tournament.name, matchId, categoryId);
}

async function reopenCurrent(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel,
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  tournament: NonNullable<Awaited<ReturnType<typeof findTournamentById>>>,
  status: string,
  homeCategoryId: string,
  settings: NonNullable<Awaited<ReturnType<typeof loadGuildSettings>>>,
  matchId: number,
): Promise<void> {
  if (status !== "closed") {
    await respondRoom(
      interaction,
      roomPanel("info", "Ticket already open", ["This battle ticket is already in an open category."]),
    );
    return;
  }
  const categoryId = await reopenTicket(channel, guild, tournament, homeCategoryId);
  await respondRoom(
    interaction,
    roomPanel("success", "Ticket reopened", [
      `Chat access is restored and the ticket is back in ${categoryMention(guild, categoryId)}.`,
    ]),
  );
  await auditTicket(interaction, guild, settings, "reopened", channel.id, tournament.name, matchId, categoryId);
}

async function deleteCurrent(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel,
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  tournamentName: string,
  roomId: string,
  settings: NonNullable<Awaited<ReturnType<typeof loadGuildSettings>>>,
  matchId: number,
): Promise<void> {
  await deleteTicket(channel, roomId);
  await auditTicket(interaction, guild, settings, "deleted", channel.id, tournamentName, matchId);
  await respondRoom(
    interaction,
    roomPanel("success", "Ticket deleted", [
      `The battle ticket for match \`${matchId}\` in **${tournamentName}** was removed.`,
      "That match can receive a new ticket later.",
    ]),
  );
}
