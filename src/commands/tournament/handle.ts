import { MessageFlags, type AutocompleteInteraction, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { tournamentCommandIdFor } from "../../lib/register-slash.js";
import { canUseTournamentRole } from "./access.js";
import { handleTournamentAdd } from "./add.js";
import { handleTournamentAddSheet } from "./add-sheet.js";
import { handleTournamentAutocomplete } from "./autocomplete.js";
import { handleTournamentDelete } from "./delete.js";
import { handleTournamentEdit } from "./edit.js";
import { handleTournamentFindPlayer } from "./find-player.js";
import { handleTournamentGetSheet } from "./get-sheet.js";
import { handleTournamentInfo } from "./info.js";
import { handleTournamentList } from "./list.js";
import { handleTournamentRole, handleTournamentRoleButton, isTournamentRoleButton } from "./role.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleTournamentSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const commandId = tournamentCommandIdFor(interaction.guildId) ?? interaction.commandId;
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    await handleTournamentAdd(interaction, commandId);
    return;
  }
  if (sub === "edit") {
    await handleTournamentEdit(interaction, commandId);
    return;
  }
  if (sub === "delete") {
    await handleTournamentDelete(interaction, commandId);
    return;
  }
  if (sub === "add_sheet") {
    await handleTournamentAddSheet(interaction, commandId);
    return;
  }
  if (sub === "get_sheet") {
    await handleTournamentGetSheet(interaction);
    return;
  }
  if (sub === "find_player") {
    await handleTournamentFindPlayer(interaction);
    return;
  }
  if (sub === "info") {
    await handleTournamentInfo(interaction, commandId);
    return;
  }
  if (sub === "list") {
    await handleTournamentList(interaction);
    return;
  }
  if (sub === "role") {
    await handleTournamentRole(interaction);
    return;
  }
}

export async function handleTournamentAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.respond([]);
    return;
  }

  if (interaction.options.getSubcommand(false) === "role" && !(await canUseTournamentRole(interaction))) {
    await interaction.respond([]);
    return;
  }

  try {
    await handleTournamentAutocomplete(interaction);
  } catch {
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => undefined);
    }
  }
}

export async function handleTournamentButton(interaction: ButtonInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  if (isTournamentRoleButton(interaction.customId)) {
    await handleTournamentRoleButton(interaction);
  }
}
