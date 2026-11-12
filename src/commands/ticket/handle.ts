import {
  ChannelType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  type TextChannel,
} from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { prisma } from "../../lib/prisma.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { parseValidationTicketTopic } from "../../lib/validation-ticket.js";
import { deferRoom, respondRoom } from "../room/respond.js";
import { roomPanel } from "../room/view.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import { auditTicket } from "./audit.js";
import { repaintScheduleChannel } from "../schedule/live.js";
import { closeTicket, deleteTicket, reopenTicket } from "./lifecycle.js";
import { regenerateTranscript } from "./regenerate.js";
import { closeValidationTicket } from "./validation.js";
import { ticketActionMessage, type TicketAction } from "./view.js";

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
        "Only an **Organiser** (manager role) or a Discord **Administrator** can change a ticket.",
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

  const validation = parseValidationTicketTopic(channel.topic);
  if (validation) {
    const sub = interaction.options.getSubcommand();
    if (sub !== "close") {
      await respondRoom(
        interaction,
        roomPanel(
          "info",
          sub === "reopen" ? "Validation ticket stays open" : "Close archives this ticket",
          [
            sub === "reopen"
              ? "A group validation ticket is not reopened. Close it to save the transcript and remove the channel."
              : "Close this validation ticket to save the transcript and remove the channel.",
          ],
        ),
      );
      return;
    }

    await deferRoom(interaction);
    try {
      await closeValidationTicket(interaction, channel, guild, settings, validation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "That ticket action could not be finished.";
      await respondRoom(interaction, roomPanel("error", "Ticket action failed", [message])).catch(() => undefined);
    }
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
  const match = await prisma.match
    .findUnique({
      where: { tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: room.challongeMatchId } },
      select: { group: true, round: true, player1Name: true, player2Name: true },
    })
    .catch(() => null);
  const card = (action: TicketAction, categoryId?: string) =>
    ticketActionMessage({
      action,
      guild,
      tournamentName: tournament.name,
      matchId: room.challongeMatchId,
      match,
      categoryId,
      actorId: interaction.user.id,
    });

  try {
    if (sub === "close") {
      await closeCurrent(interaction, channel, guild, tournament, room.status, settings, room.challongeMatchId, card);
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
        card,
      );
      return;
    }
    if (sub === "transcript") {
      await regenerateTranscript({ interaction, ticket: channel, guild, tournament, settings, room, match });
      return;
    }
    if (sub === "delete") {
      await deleteCurrent(interaction, channel, guild, tournament.name, room.id, settings, room.challongeMatchId, card);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "That ticket action could not be finished.";
    await respondRoom(interaction, roomPanel("error", "Ticket action failed", [message]));
  }
}

type TicketCard = (action: TicketAction, categoryId?: string) => InteractionReplyOptions;

async function closeCurrent(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel,
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  tournament: NonNullable<Awaited<ReturnType<typeof findTournamentById>>>,
  status: string,
  settings: NonNullable<Awaited<ReturnType<typeof loadGuildSettings>>>,
  matchId: number,
  card: TicketCard,
): Promise<void> {
  if (status === "closed") {
    await respondRoom(interaction, card("already-closed"));
    return;
  }
  const categoryId = await closeTicket(channel, guild, tournament);
  await repaintScheduleChannel(guild, channel, settings, tournament).catch((error) => {
    console.error("Schedule seat lock failed", error);
  });
  await respondRoom(interaction, card("closed", categoryId));
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
  card: TicketCard,
): Promise<void> {
  if (status !== "closed") {
    await respondRoom(interaction, card("already-open"));
    return;
  }
  const categoryId = await reopenTicket(channel, guild, tournament, homeCategoryId);
  await repaintScheduleChannel(guild, channel, settings, tournament).catch((error) => {
    console.error("Schedule seat lock failed", error);
  });
  await respondRoom(interaction, card("reopened", categoryId));
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
  card: TicketCard,
): Promise<void> {
  await deleteTicket(channel, roomId);
  await auditTicket(interaction, guild, settings, "deleted", channel.id, tournamentName, matchId);
  await respondRoom(interaction, card("deleted"));
}
