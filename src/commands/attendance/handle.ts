import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
import { handleAttendanceAutocomplete } from "./autocomplete.js";
import { handleAttendanceDelete } from "./delete.js";
import { handleAttendanceReport } from "./report.js";
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
  if (sub === "report") {
    await handleAttendanceReport(interaction);
  }
}

export async function handleAttendanceAuto(interaction: AutocompleteInteraction): Promise<void> {
  if (
    !(await actorMatches(interaction, {
      admin: true,
      organiser: true,
      helper: true,
      staff: true,
      judge: true,
      recorder: true,
    }))
  ) {
    await interaction.respond([]);
    return;
  }
  await handleAttendanceAutocomplete(interaction);
}
