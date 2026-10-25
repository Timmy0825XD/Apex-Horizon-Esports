import type { ChatInputCommandInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
import { deferTournament, respondTournament } from "./respond.js";
import { findTournamentById } from "./store.js";
import { tournamentErrorMessage, tournamentWorldMessage } from "./view.js";

export async function handleTournamentInfo(interaction: ChatInputCommandInteraction, commandId?: string): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(interaction, tournamentErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Admin or organiser required", "You need **Admin** or **Organiser** to view a tournament."),
    );
    return;
  }

  await deferTournament(interaction);

  const tournament = await findTournamentById(guild.id, interaction.options.getString("id", true));
  if (!tournament) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondTournament(interaction, tournamentWorldMessage("info", guild, tournament, commandId));
}
