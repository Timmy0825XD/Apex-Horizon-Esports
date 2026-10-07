import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";

export async function handleBracketAuto(interaction: AutocompleteInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused(true);
  if (focused.name === "tournament") {
    const query = focused.value.trim().toLowerCase();
    const tournaments = await prisma.tournament.findMany({
      where: { guildId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    await interaction.respond(
      tournaments
        .filter((row) => !query || row.name.toLowerCase().includes(query))
        .slice(0, 25)
        .map((row) => ({ name: row.name.slice(0, 100), value: row.id })),
    );
    return;
  }

  if (focused.name !== "match") {
    await interaction.respond([]);
    return;
  }

  const tournamentId = interaction.options.getString("tournament");
  if (!tournamentId) {
    await interaction.respond([]);
    return;
  }

  const query = focused.value.trim().toLowerCase();
  const closedRooms = await prisma.room.findMany({
    where: { guildId, tournamentId, status: "closed" },
    select: { challongeMatchId: true },
  });
  const closedIds = closedRooms.map((room) => room.challongeMatchId);
  const matches = await prisma.match.findMany({
    where: {
      guildId,
      tournamentId,
      OR: [{ state: "complete" }, { challongeMatchId: { in: closedIds } }],
    },
    orderBy: [{ round: "asc" }, { challongeMatchId: "asc" }],
  });

  await interaction.respond(
    matches
      .map((match) => {
        const label = `${match.player1Name} vs ${match.player2Name}`;
        return {
          name: label.slice(0, 100),
          value: String(match.challongeMatchId),
          haystack: `${label} ${match.challongeMatchId}`.toLowerCase(),
        };
      })
      .filter((choice) => !query || choice.haystack.includes(query))
      .slice(0, 25)
      .map(({ name, value }) => ({ name, value })),
  );
}
