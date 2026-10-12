import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { sheetCommandIdFor, tournamentCommandIdFor, utilityCommandIdFor } from "../../lib/register-slash.js";
import { handleSheetAdd } from "./add.js";
import { handleSheetAutocomplete } from "./autocomplete.js";
import { handleSheetFindPlayer } from "./find-player.js";
import { handleSheetGet } from "./get.js";
import { handleSheetValidate } from "./validate.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleSheetSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const commandId = sheetCommandIdFor(interaction.guildId) ?? interaction.commandId;
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    await handleSheetAdd(interaction, commandId);
    return;
  }
  if (sub === "get") {
    await handleSheetGet(interaction, commandId);
    return;
  }
  if (sub === "find_player") {
    await handleSheetFindPlayer(interaction);
    return;
  }
  if (sub === "validate") {
    await handleSheetValidate(interaction, {
      tournamentCommandId: tournamentCommandIdFor(interaction.guildId),
      utilityCommandId: utilityCommandIdFor(interaction.guildId),
    });
  }
}

export async function handleSheetAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.respond([]);
    return;
  }

  try {
    await handleSheetAutocomplete(interaction);
  } catch {
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => undefined);
    }
  }
}
