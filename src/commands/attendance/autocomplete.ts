import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { isObjectId, whereActive } from "./store.js";

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

export async function respondAttendanceMatches(interaction: AutocompleteInteraction): Promise<void> {
  const guildId = interaction.guildId;
  const tournamentId = interaction.options.getString("tournament");
  if (!guildId || !tournamentId || !isObjectId(tournamentId)) {
    await interaction.respond([]);
    return;
  }
  const rows = await prisma.attendance.findMany({
    where: whereActive({ guildId, tournamentId }),
    select: { challongeMatchId: true },
  });
  const ids = rows.map((row) => row.challongeMatchId);
  const matches = ids.length
    ? await prisma.match.findMany({ where: { tournamentId, challongeMatchId: { in: ids } } })
    : [];
  const byId = new Map(matches.map((match) => [match.challongeMatchId, match]));
  const query = interaction.options.getFocused().trim().toLowerCase();
  const choices = rows
    .map((row) => {
      const match = byId.get(row.challongeMatchId);
      const name = match ? `${match.player1Name} vs ${match.player2Name}` : `Match ${row.challongeMatchId}`;
      return { name: name.slice(0, 100), value: String(row.challongeMatchId) };
    })
    .filter((choice) => !query || choice.name.toLowerCase().includes(query))
    .slice(0, 25);
  await interaction.respond(choices);
}

export async function handleAttendanceAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name === "remark") {
    const query = focused.value.trim().toLowerCase();
    const choice = { name: "DW — Default Win (disqualification)", value: "DW" };
    await interaction.respond(!query || choice.name.toLowerCase().includes(query) || choice.value.toLowerCase().includes(query) ? [choice] : []);
    return;
  }
  if (focused.name === "tournament") {
    await respondTournamentChoices(interaction);
    return;
  }
  await interaction.respond([]);
}
