import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { canUseTeamCommands, requireTeamOrganiser } from "./access.js";
import { handleTeamAutocomplete } from "./autocomplete.js";
import { handleTeamInfo } from "./info.js";
import { handleTeamList } from "./list.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleTeamSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  if (!(await requireTeamOrganiser(interaction, "use team commands"))) {
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "info") {
    await handleTeamInfo(interaction);
    return;
  }
  if (sub === "list") {
    await handleTeamList(interaction);
  }
}

export async function handleTeamAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId) || !(await canUseTeamCommands(interaction))) {
    await interaction.respond([]);
    return;
  }

  try {
    await handleTeamAutocomplete(interaction);
  } catch {
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => undefined);
    }
  }
}
