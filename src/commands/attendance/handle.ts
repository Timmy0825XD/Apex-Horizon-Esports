import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { handleAttendanceAutocomplete } from "./autocomplete.js";
import { handleAttendanceDelete } from "./delete.js";
import { handleAttendanceList } from "./list.js";
import { handleAttendanceMark } from "./mark.js";

export async function handleAttendanceSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(false);
  if (sub === "mark") {
    await handleAttendanceMark(interaction);
    return;
  }
  if (sub === "delete") {
    await handleAttendanceDelete(interaction);
    return;
  }
  if (sub === "list") {
    await handleAttendanceList(interaction);
  }
}

export async function handleAttendanceAuto(interaction: AutocompleteInteraction): Promise<void> {
  await handleAttendanceAutocomplete(interaction);
}
