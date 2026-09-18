import type { ChatInputCommandInteraction } from "discord.js";
import { loadParsedSheet } from "../../lib/sheet.js";
import { rosterLoadError } from "./errors.js";
import { resolvePresence } from "./presence.js";
import { deferTeam, followTeam, respondTeam } from "./respond.js";
import { findGuildTournament } from "./store.js";
import { teamCardMessage, teamErrorMessage } from "./view.js";

const POST_GAP_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function handleTeamList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTeam(interaction, teamErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  await deferTeam(interaction);

  const tournament = await findGuildTournament(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await respondTeam(
      interaction,
      teamErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  let posted = 0;
  try {
    const sheet = await loadParsedSheet(tournament.sheetLink);
    if (sheet.teams.length === 0) {
      await respondTeam(
        interaction,
        teamErrorMessage("No participants", `**${tournament.name}** has no teams to publish.`, false),
      );
      return;
    }

    const presence = await resolvePresence(guild, sheet.teams);
    const total = sheet.teams.length;

    for (const [index, team] of sheet.teams.entries()) {
      const payload = teamCardMessage({
        tournament,
        format: sheet.format,
        team,
        presence,
        requestedBy: interaction.user.id,
        position: { index: index + 1, total },
      });

      if (index === 0) {
        await respondTeam(interaction, payload);
      } else {
        await followTeam(interaction, payload);
      }
      posted += 1;

      if (index < total - 1) {
        await wait(POST_GAP_MS);
      }
    }
  } catch (error) {
    const payload = teamErrorMessage("Could not load participants", rosterLoadError(error), false);
    if (posted === 0) {
      await respondTeam(interaction, payload);
    } else {
      await followTeam(interaction, payload);
    }
  }
}
