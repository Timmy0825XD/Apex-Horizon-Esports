import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { handleSettingsEdit } from "./edit.js";
import { handleSettingsSet } from "./set.js";
import { handleSettingsShow } from "./show.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleSettingsSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const commandId = settingsCommandIdFor(interaction.guildId) ?? interaction.commandId;
  const sub = interaction.options.getSubcommand();

  if (sub === "set") {
    await handleSettingsSet(interaction, commandId);
    return;
  }
  if (sub === "edit") {
    await handleSettingsEdit(interaction, commandId);
    return;
  }
  if (sub === "show") {
    await handleSettingsShow(interaction, commandId);
  }
}
