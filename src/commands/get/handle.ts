import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
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
  const sub = interaction.options.getSubcommand(false);
  const allowed =
    sub === "sheet"
      ? await actorMatches(interaction, { organiser: true })
      : await actorMatches(interaction, {
          admin: true,
          organiser: true,
          helper: true,
          staff: true,
          judge: true,
          recorder: true,
        });
  if (!allowed) {
    await interaction.respond([]);
    return;
  }
  await handleAttendanceAutocomplete(interaction);
}
