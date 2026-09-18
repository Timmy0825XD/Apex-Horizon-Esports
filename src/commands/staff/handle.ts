import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { staffCommandIdFor } from "../../lib/register-slash.js";
import { handleStaffAutocomplete } from "./autocomplete.js";
import { handleStaffConfigEdit } from "./edit.js";
import { handleStaffFire } from "./fire.js";
import { handleStaffRecruit } from "./recruit.js";
import { handleStaffConfigSet } from "./set.js";
import { handleStaffConfigView } from "./show.js";
import { handleStaffWork } from "./work.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleStaffSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const commandId = staffCommandIdFor(interaction.guildId) ?? interaction.commandId;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === "config") {
    if (sub === "set") {
      await handleStaffConfigSet(interaction, commandId);
      return;
    }
    if (sub === "edit") {
      await handleStaffConfigEdit(interaction, commandId);
      return;
    }
    if (sub === "view") {
      await handleStaffConfigView(interaction, commandId);
    }
    return;
  }

  if (sub === "recruit") {
    await handleStaffRecruit(interaction, commandId);
    return;
  }
  if (sub === "fire") {
    await handleStaffFire(interaction, commandId);
    return;
  }
  if (sub === "work") {
    await handleStaffWork(interaction);
  }
}

export async function handleStaffAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.respond([]);
    return;
  }

  try {
    await handleStaffAutocomplete(interaction);
  } catch {
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => undefined);
    }
  }
}
