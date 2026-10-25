import type { ChatInputCommandInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
import { deferTournament, respondTournament } from "./respond.js";
import { listTournaments } from "./store.js";
import { tournamentErrorMessage, tournamentListMessage } from "./view.js";

export async function handleTournamentList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(interaction, tournamentErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Admin or organiser required", "You need **Admin** or **Organiser** to list tournaments."),
    );
    return;
  }

  await deferTournament(interaction, true);
  const tournaments = await listTournaments(guild.id);
  await respondTournament(interaction, tournamentListMessage(tournaments));
}
