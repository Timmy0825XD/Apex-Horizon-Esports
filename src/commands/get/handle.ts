import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { handleAttendanceAutocomplete } from "../attendance/autocomplete.js";
import { handleGetAttendance } from "./history.js";
import { handleGetSheet } from "./sheet.js";

export async function handleGetSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(false);
  if (sub === "attendance") {
    await handleGetAttendance(interaction);
    return;
  }
  if (sub === "sheet") {
    await handleGetSheet(interaction);
  }
}

export async function handleGetAuto(interaction: AutocompleteInteraction): Promise<void> {
  await handleAttendanceAutocomplete(interaction);
}
