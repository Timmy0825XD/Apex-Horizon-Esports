import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, InteractionReplyOptions } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { loadGuildSettings } from "../settings/store.js";
import { tournamentErrorMessage } from "./view.js";

export type AdminContext = {
  guild: Guild;
  settings: GuildSettings;
};

export async function requireAdmin(
  interaction: ChatInputCommandInteraction,
  action: string,
): Promise<AdminContext | { error: InteractionReplyOptions }> {
  const guild = interaction.guild;
  if (!guild) {
    return { error: tournamentErrorMessage("Guild only", "This command can only be used in a server.") };
  }

  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    return {
      error: tournamentErrorMessage(
        "Settings not configured",
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first. Tournament commands need the server layer (admin role and logs).`,
        false,
      ),
    };
  }

  if (!isGuildAdmin(interaction, settings)) {
    return {
      error: tournamentErrorMessage(
        "Admin only",
        `You need the Discord **Administrator** permission or the configured **Admin Role** to ${action}.`,
        false,
      ),
    };
  }

  return { guild, settings };
}

export function isAdminContext(value: AdminContext | { error: InteractionReplyOptions }): value is AdminContext {
  return "guild" in value && "settings" in value;
}
