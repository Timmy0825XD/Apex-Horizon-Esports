import type { AutocompleteInteraction } from "discord.js";
import { listStoredSheetSummaries } from "../tournament/store.js";

export async function handleSheetAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const sub = interaction.options.getSubcommand(false);
  if (sub !== "get" || focused.name !== "name") {
    await interaction.respond([]);
    return;
  }

  const query = focused.value.trim().toLowerCase();
  const sheets = await listStoredSheetSummaries();
  const matches = sheets
    .filter((sheet) => {
      const name = (sheet.tournamentName ?? "").toLowerCase();
      const server = sheet.guildName.toLowerCase();
      return !query || name.includes(query) || server.includes(query);
    })
    .slice(0, 25)
    .map((sheet) => {
      const label = `${sheet.tournamentName || "Untitled sheet"} · ${sheet.guildName || "Unknown server"}`;
      return { name: label.slice(0, 100), value: sheet.id };
    });

  await interaction.respond(matches);
}
