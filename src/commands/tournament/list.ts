import type { ChatInputCommandInteraction } from "discord.js";
import { deferTournament, respondTournament } from "./respond.js";
import { listTournaments } from "./store.js";
import { tournamentErrorMessage, tournamentListMessage } from "./view.js";

export async function handleTournamentList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(interaction, tournamentErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferTournament(interaction, true);
  const tournaments = await listTournaments(guild.id);
  await respondTournament(interaction, tournamentListMessage(tournaments));
}
