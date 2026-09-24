import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";

export async function respondTournamentChoices(interaction: AutocompleteInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }

  const query = interaction.options.getFocused().trim().toLowerCase();
  const tournaments = await prisma.tournament.findMany({
    where: { guildId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const matches = (query ? tournaments.filter((row) => row.name.toLowerCase().includes(query)) : tournaments)
    .slice(0, 25)
    .map((row) => ({ name: row.name.slice(0, 100), value: row.id }));
  await interaction.respond(matches);
}
