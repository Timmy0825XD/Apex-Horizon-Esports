import { MessageFlags, type AutocompleteInteraction, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { handleBracketAuto } from "./autocomplete.js";
import { handleBracketButton, runBracketCorrect } from "./correct.js";
import { runBracketUpload } from "./upload.js";
import { bracketPanel } from "./view.js";
import { respondBracket } from "./respond.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleBracketSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "upload") {
    await runBracketUpload(interaction);
    return;
  }
  if (sub === "correct") {
    await runBracketCorrect(interaction);
    return;
  }

  await respondBracket(
    interaction,
    bracketPanel("error", "Unknown subcommand", ["That `/bracket` action is not available."]),
  );
}

export async function handleBracketAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.respond([]);
    return;
  }
  await handleBracketAuto(interaction);
}

export async function handleBracketButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }
  await handleBracketButton(interaction);
}
