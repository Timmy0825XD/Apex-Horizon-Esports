import { MessageFlags, type AutocompleteInteraction, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { ChallongeError } from "../../lib/challonge.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { TicketQueueError, loadTicketQueue } from "./bracket.js";
import { auditRoomsCreated } from "./audit.js";
import { respondRoomChoices } from "./autocomplete.js";
import { openPendingTickets, type RoomScope } from "./open.js";
import { roundTitle } from "./labels.js";
import { prepareTournament } from "./prepare.js";
import { deferRoom, respondRoom } from "./respond.js";
import { findTournamentById } from "../tournament/store.js";
import { creationReport } from "./report.js";
import { availableRoomsMessage, blockedSummary, parseAvailableCustomId, roomPanel } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleRoomSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "create") {
    await handleCreate(interaction);
    return;
  }
  if (sub === "available") {
    await handleAvailable(interaction);
  }
}

export async function handleRoomAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId) || !(await memberIsOrganiser(interaction))) {
    await interaction.respond([]);
    return;
  }
  try {
    await respondRoomChoices(interaction);
  } catch {
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => undefined);
    }
  }
}

function readScope(interaction: ChatInputCommandInteraction): RoomScope | string {
  const group = interaction.options.getString("group");
  const roundRaw = interaction.options.getString("round");
  if (roundRaw != null && !/^-?\d+$/.test(roundRaw)) {
    return "Choose a round from the list for this tournament.";
  }
  return {
    group,
    round: roundRaw == null ? null : Number(roundRaw),
  };
}

function scopeText(scope: RoomScope): string {
  const parts = [scope.group ? `**Group ${scope.group}**` : "", scope.round != null ? `**${roundTitle(scope.round)}**` : ""].filter(
    Boolean,
  );
  return parts.join(" · ");
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const ready = await prepareTournament(interaction, "open battle tickets");
  if (!ready) {
    return;
  }

  const scope = readScope(interaction);
  if (typeof scope === "string") {
    await respondRoom(interaction, roomPanel("error", "Unknown round", [scope]));
    return;
  }

  await deferRoom(interaction, false);
  try {
    const result = await openPendingTickets(ready.guild, ready.tournament, scope);
    const where = scopeText(scope);
    if (result.created.length === 0 && result.failed.length === 0) {
      await respondRoom(
        interaction,
        roomPanel("info", "No tickets waiting", [
          where
            ? `Every open match in **${ready.tournament.name}** for ${where} already has a battle ticket.`
            : `Every open match in **${ready.tournament.name}** already has a battle ticket.`,
        ]),
      );
      return;
    }

    await respondRoom(
      interaction,
      creationReport(ready.guild, ready.tournament.name, result, where ? { intro: [`Opening ${where}.`] } : undefined),
    );
    await auditRoomsCreated(
      ready.guild,
      ready.settings,
      interaction.user,
      ready.tournament.name,
      result.created,
      result.failed.length,
    );
  } catch (error) {
    const message =
      error instanceof TicketQueueError || error instanceof ChallongeError
        ? error.message
        : "The ticket queue could not be read. Try again in a moment.";
    await respondRoom(interaction, roomPanel("error", "Could not open tickets", [message]));
  }
}

async function handleAvailable(interaction: ChatInputCommandInteraction): Promise<void> {
  const ready = await prepareTournament(interaction, "view the ticket queue");
  if (!ready) {
    return;
  }

  await deferRoom(interaction, false);
  try {
    await respondRoom(interaction, await availableReply(ready.tournament.guildId, ready.tournament.id, 0));
  } catch (error) {
    const message =
      error instanceof TicketQueueError || error instanceof ChallongeError
        ? error.message
        : "The ticket queue could not be read. Try again in a moment.";
    await respondRoom(interaction, roomPanel("error", "Could not read the queue", [message]));
  }
}

async function availableReply(guildId: string, tournamentId: string, page: number) {
  const tournament = await findTournamentById(guildId, tournamentId);
  if (!tournament) {
    return roomPanel("error", "Tournament not found", ["That tournament is not registered in this server."]);
  }
  const queue = await loadTicketQueue(tournament);
  if (queue.ready.length === 0 && queue.blocked.length === 0) {
    return roomPanel("info", "No rooms available", [
      `Every open match in **${tournament.name}** already has a battle ticket.`,
    ]);
  }
  if (queue.ready.length === 0) {
    return roomPanel("error", "No rooms available", [
      `**${tournament.name}** has open matches, but none can become a ticket yet.`,
      ...blockedSummary(queue.blocked),
    ]);
  }
  return availableRoomsMessage(tournament.name, tournament.id, queue.ready, page, queue.blocked.length);
}

export async function handleRoomButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseAvailableCustomId(interaction.customId);
  if (!parsed || !isAllowedGuild(interaction.guildId) || !interaction.guildId) {
    return;
  }
  if (!(await memberIsOrganiser(interaction))) {
    await interaction.reply(
      roomPanel("error", "Organiser required", [
        "Only an **Organiser** (manager role) or a Discord **Administrator** can page this list.",
      ]),
    );
    return;
  }

  await interaction.deferUpdate();
  try {
    const payload = await availableReply(interaction.guildId, parsed.tournamentId, parsed.page);
    await interaction.editReply({
      components: payload.components,
      allowedMentions: { parse: [] },
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    const message =
      error instanceof TicketQueueError || error instanceof ChallongeError
        ? error.message
        : "The ticket queue could not be read. Try again in a moment.";
    await interaction.editReply({
      components: roomPanel("error", "Could not read the queue", [message]).components,
      allowedMentions: { parse: [] },
      flags: MessageFlags.IsComponentsV2,
    });
  }
}
