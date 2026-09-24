import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { findTournamentById } from "../tournament/store.js";
import { loadTicketQueue } from "./bracket.js";
import { roundTitle } from "./labels.js";

export async function respondRoomChoices(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name === "group" || focused.name === "round") {
    await respondStageChoices(interaction, focused.name, focused.value);
    return;
  }
  await respondTournamentChoices(interaction);
}

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

async function respondStageChoices(
  interaction: AutocompleteInteraction,
  field: "group" | "round",
  raw: string,
): Promise<void> {
  const guildId = interaction.guildId;
  const tournamentId = interaction.options.getString("tournament");
  if (!guildId || !tournamentId) {
    await interaction.respond([]);
    return;
  }

  let stages = await readStages(guildId, tournamentId);
  if (stages.length === 0) {
    const tournament = await findTournamentById(guildId, tournamentId);
    if (tournament) {
      await loadTicketQueue(tournament).catch(() => undefined);
      stages = await readStages(guildId, tournamentId);
    }
  }

  const selectedGroup = interaction.options.getString("group");
  const selectedRound = interaction.options.getString("round");
  const roundNumber = selectedRound != null && /^-?\d+$/.test(selectedRound) ? Number(selectedRound) : null;
  const narrowed = stages.filter((stage) => {
    if (field !== "group" && selectedGroup && stage.group !== selectedGroup) {
      return false;
    }
    if (field !== "round" && roundNumber != null && stage.round !== roundNumber) {
      return false;
    }
    return true;
  });

  const query = raw.trim().toLowerCase();
  if (field === "group") {
    const groups = [...new Set(narrowed.flatMap((stage) => (stage.group ? [stage.group] : [])))].sort();
    await interaction.respond(
      groups
        .filter((group) => !query || `group ${group}`.toLowerCase().includes(query) || group.toLowerCase().includes(query))
        .slice(0, 25)
        .map((group) => ({ name: `Group ${group}`.slice(0, 100), value: group })),
    );
    return;
  }

  const rounds = [...new Set(narrowed.map((stage) => stage.round))].sort(compareRounds);
  await interaction.respond(
    rounds
      .filter((round) => {
        const title = roundTitle(round).toLowerCase();
        return !query || title.includes(query) || String(round) === query;
      })
      .slice(0, 25)
      .map((round) => ({ name: roundTitle(round).slice(0, 100), value: String(round) })),
  );
}

function compareRounds(left: number, right: number): number {
  if (left >= 0 && right >= 0) {
    return left - right;
  }
  if (left < 0 && right < 0) {
    return Math.abs(left) - Math.abs(right);
  }
  return left >= 0 ? -1 : 1;
}

async function readStages(guildId: string, tournamentId: string): Promise<Array<{ group: string | null; round: number }>> {
  return prisma.match.findMany({
    where: { guildId, tournamentId },
    select: { group: true, round: true },
  });
}
