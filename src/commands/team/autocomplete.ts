import type { AutocompleteInteraction } from "discord.js";
import { listGuildTournaments } from "./store.js";

export async function handleTeamAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "tournament") {
    await interaction.respond([]);
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }

  const query = focused.value.trim().toLowerCase();
  const tournaments = await listGuildTournaments(guildId);
  const matches = (query ? tournaments.filter((row) => row.name.toLowerCase().includes(query)) : tournaments)
    .slice(0, 25)
    .map((row) => ({ name: row.name.slice(0, 100), value: row.id }));

  await interaction.respond(matches);
}
