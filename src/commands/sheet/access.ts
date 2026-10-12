import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, InteractionReplyOptions } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin } from "../../lib/permissions.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { loadGuildSettings } from "../settings/store.js";
import { sheetErrorMessage } from "./view.js";

export type SheetAdminContext = {
  guild: Guild;
  settings: GuildSettings;
};

export async function requireSheetAdmin(
  interaction: ChatInputCommandInteraction,
  action: string,
): Promise<SheetAdminContext | { error: InteractionReplyOptions }> {
  const guild = interaction.guild;
  if (!guild) {
    return { error: sheetErrorMessage("Guild only", "This command can only be used in a server.") };
  }

  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    return {
      error: sheetErrorMessage(
        "Settings not configured",
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first. Sheet commands need the server layer (admin role and logs).`,
        false,
      ),
    };
  }

  if (!isGuildAdmin(interaction, settings)) {
    return {
      error: sheetErrorMessage(
        "Admin only",
        `You need the Discord **Administrator** permission or the configured **Admin Role** to ${action}.`,
        false,
      ),
    };
  }

  return { guild, settings };
}

export function isSheetAdmin(value: SheetAdminContext | { error: InteractionReplyOptions }): value is SheetAdminContext {
  return "guild" in value && "settings" in value;
}
