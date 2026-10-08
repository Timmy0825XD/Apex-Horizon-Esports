import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { handleAttendanceAutocomplete, respondAttendanceMatches } from "../attendance/autocomplete.js";
import { handleLinkAdd } from "./add.js";
import { handleLinkMissing } from "./missing.js";
import { handleLinkDelete } from "./remove.js";

export async function handleLinkSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(false);
  if (sub === "add") {
    await handleLinkAdd(interaction);
    return;
  }
  if (sub === "delete") {
    await handleLinkDelete(interaction);
    return;
  }
  if (sub === "missing") {
    await handleLinkMissing(interaction);
  }
}

export async function handleLinkAuto(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name === "match") {
    await respondAttendanceMatches(interaction);
    return;
  }
  await handleAttendanceAutocomplete(interaction);
}
