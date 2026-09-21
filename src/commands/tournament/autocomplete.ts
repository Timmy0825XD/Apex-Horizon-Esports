import type { AutocompleteInteraction } from "discord.js";
import { discordIdHeaders } from "../../lib/sheet.js";
import { prisma } from "../../lib/prisma.js";
import { findTournamentById, findTournamentSheetHeaders, listStoredSheetSummaries } from "./store.js";

export async function handleTournamentAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const sub = interaction.options.getSubcommand(false);

  if (sub === "get_sheet" && focused.name === "name") {
    await respondStoredSheetNames(interaction, focused.value);
    return;
  }

  if (sub === "role" && focused.name === "id_header") {
    await respondDiscordIdHeaders(interaction, focused.value);
    return;
  }

  if (focused.name !== "id" && focused.name !== "tournament") {
    await interaction.respond([]);
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }

  const query = focused.value.trim().toLowerCase();
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

async function respondDiscordIdHeaders(interaction: AutocompleteInteraction, raw: string): Promise<void> {
  const guildId = interaction.guildId;
  const tournamentId = interaction.options.getString("tournament");
  if (!guildId || !tournamentId) {
    await interaction.respond([]);
    return;
  }

  const tournament = await findTournamentById(guildId, tournamentId);
  if (!tournament) {
    await interaction.respond([]);
    return;
  }

  const storedHeaders = await findTournamentSheetHeaders(guildId, tournament.id);
  const query = raw.trim().toLowerCase();
  const matches = discordIdHeaders(tournament.format, storedHeaders ?? [])
    .filter((header) => !query || header.label.toLowerCase().includes(query) || String(header.slot + 1) === query)
    .map((header) => ({ name: header.label.slice(0, 100), value: String(header.slot) }));

  await interaction.respond(matches);
}

async function respondStoredSheetNames(interaction: AutocompleteInteraction, raw: string): Promise<void> {
  const query = raw.trim().toLowerCase();
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
