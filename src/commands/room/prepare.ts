import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { loadGuildSettings } from "../settings/store.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { findTournamentById } from "../tournament/store.js";
import { respondRoom } from "./respond.js";
import { roomPanel } from "./view.js";

export type RoomContext = {
  guild: Guild;
  settings: GuildSettings;
  tournament: TournamentRecord;
};

export async function prepareTournament(
  interaction: ChatInputCommandInteraction,
  action: string,
): Promise<RoomContext | null> {
  const guild = interaction.guild;
  if (!guild || !interaction.guildId) {
    await respondRoom(interaction, roomPanel("error", "Guild only", ["This command can only be used in a server."]));
    return null;
  }

  if (!(await memberIsOrganiser(interaction))) {
    await respondRoom(
      interaction,
      roomPanel("error", "Organiser required", [
        `Only an **Organiser** (manager role) or a Discord **Administrator** can ${action}.`,
      ]),
    );
    return null;
  }

  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    await respondRoom(
      interaction,
      roomPanel("error", "Settings not configured", [
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first. Battle tickets need the server log channels.`,
      ]),
    );
    return null;
  }

  const tournament = await findTournamentById(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await respondRoom(
      interaction,
      roomPanel("error", "Tournament not found", ["That tournament is not registered in this server."]),
    );
    return null;
  }

  return { guild, settings, tournament };
}
