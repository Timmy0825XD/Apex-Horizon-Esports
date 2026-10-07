import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";

function utcStamp(when: Date): string {
  const day = String(when.getUTCDate()).padStart(2, "0");
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${when.getUTCFullYear()}-${month}-${day} ${hour}:${minute} UTC`;
}

export async function handleScheduleAuto(interaction: AutocompleteInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }
  const focused = interaction.options.getFocused(true);
  const sub = interaction.options.getSubcommand(false);

  if (sub === "refresh" && focused.name === "match") {
    const query = focused.value.trim().toLowerCase();
    const schedules = await prisma.schedule.findMany({ where: { guildId }, orderBy: { scheduledAt: "asc" } });
    const tournamentIds = [...new Set(schedules.map((row) => row.tournamentId))];
    const [tournaments, matches] = await Promise.all([
      prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true } }),
      prisma.match.findMany({ where: { tournamentId: { in: tournamentIds } } }),
    ]);
    const choices = schedules
      .map((schedule) => {
        const tournament = tournaments.find((row) => row.id === schedule.tournamentId);
        const match = matches.find(
          (item) => item.tournamentId === schedule.tournamentId && item.challongeMatchId === schedule.challongeMatchId,
        );
        const names = match ? `${match.player1Name} vs ${match.player2Name}` : `Match ${schedule.challongeMatchId}`;
        const event = tournament?.name ?? "Tournament";
        const label = `${names} | ${event} | ${utcStamp(schedule.scheduledAt)}`;
        return { name: label.slice(0, 100), value: schedule.id, haystack: label.toLowerCase() };
      })
      .filter((choice) => !query || choice.haystack.includes(query))
      .slice(0, 25)
      .map(({ name, value }) => ({ name, value }));
    await interaction.respond(choices);
    return;
  }

  if (focused.name === "tournament") {
    const query = focused.value.trim().toLowerCase();
    const tournaments = await prisma.tournament.findMany({ where: { guildId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    await interaction.respond(
      tournaments
        .filter((row) => !query || row.name.toLowerCase().includes(query))
        .slice(0, 25)
        .map((row) => ({ name: row.name.slice(0, 100), value: row.id })),
    );
    return;
  }
  const tournamentId = interaction.options.getString("tournament");
  if (!tournamentId) {
    await interaction.respond([]);
    return;
  }
  const query = focused.value.trim().toLowerCase();
  const schedules = await prisma.schedule.findMany({ where: { guildId, tournamentId }, orderBy: { scheduledAt: "asc" } });
  const matches = await prisma.match.findMany({ where: { tournamentId } });
  const choices = schedules
    .map((schedule) => {
      const match = matches.find((item) => item.challongeMatchId === schedule.challongeMatchId);
      const label = match ? `${match.player1Name} vs ${match.player2Name}` : `Match ${schedule.challongeMatchId}`;
      return { name: label.slice(0, 100), value: String(schedule.challongeMatchId), haystack: label.toLowerCase() };
    })
    .filter((choice) => !query || choice.haystack.includes(query))
    .slice(0, 25)
    .map(({ name, value }) => ({ name, value }));
  await interaction.respond(choices);
}
