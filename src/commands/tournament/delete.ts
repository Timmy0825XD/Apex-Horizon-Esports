import type { ChatInputCommandInteraction } from "discord.js";
import { isAdminContext, requireAdmin } from "./access.js";
import { auditTournamentDelete } from "./audit.js";
import { deferTournament, respondTournament } from "./respond.js";
import { deleteTournamentWorld, findTournamentById } from "./store.js";
import { tournamentDeletedMessage, tournamentErrorMessage } from "./view.js";

export async function handleTournamentDelete(
  interaction: ChatInputCommandInteraction,
  commandId?: string,
): Promise<void> {
  await deferTournament(interaction);

  const access = await requireAdmin(interaction, "delete a tournament");
  if (!isAdminContext(access)) {
    await respondTournament(interaction, access.error);
    return;
  }

  const { guild, settings } = access;
  const tournament = await findTournamentById(guild.id, interaction.options.getString("id", true));
  if (!tournament) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  const related = await deleteTournamentWorld(guild.id, tournament.id);
  await respondTournament(interaction, tournamentDeletedMessage(tournament.name, related, commandId));
  await auditTournamentDelete(
    interaction,
    guild,
    settings,
    tournament.name,
    tournament.challongeId,
    related,
  );
}
