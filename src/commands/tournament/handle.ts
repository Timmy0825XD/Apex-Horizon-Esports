import { MessageFlags, type AutocompleteInteraction, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { tournamentCommandIdFor } from "../../lib/register-slash.js";
import { canUseTournamentRole } from "./access.js";
import { handleTournamentAdd } from "./add.js";
import { handleTournamentAutocomplete } from "./autocomplete.js";
import { handleTournamentDelete } from "./delete.js";
import { handleTournamentEdit } from "./edit.js";
import { handleTournamentInfo } from "./info.js";
import { handleTournamentList } from "./list.js";
import { handleTournamentReport } from "./report.js";
import { handleTournamentRole, handleTournamentRoleButton, isTournamentRoleButton } from "./role.js";
import { handleTournamentValidate } from "./validate.js";

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
    await handleTournamentDelete(interaction);
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
  if (sub === "validate") {
    await handleTournamentValidate(interaction);
    return;
  }
  if (sub === "report") {
    await handleTournamentReport(interaction);
  }
}

export async function handleTournamentAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.respond([]);
    return;
  }

  const sub = interaction.options.getSubcommand(false);
  if ((sub === "role" || sub === "validate" || sub === "report") && !(await canUseTournamentRole(interaction))) {
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
