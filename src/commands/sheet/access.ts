import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, InteractionReplyOptions } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { loadStaffConfig } from "../../lib/organiser.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
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
  options?: { organiser?: boolean },
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

  const staff = options?.organiser ? await loadStaffConfig(guild.id) : null;
  if (!isGuildAdmin(interaction, settings) && !(options?.organiser && isOrganiser(interaction, staff))) {
    return {
      error: sheetErrorMessage(
        options?.organiser ? "Admin or organiser required" : "Admin only",
        options?.organiser
          ? `You need **Admin** or **Organiser** to ${action}.`
          : `You need the Discord **Administrator** permission or the configured **Admin Role** to ${action}.`,
        false,
      ),
    };
  }

  return { guild, settings };
}

export function isSheetAdmin(value: SheetAdminContext | { error: InteractionReplyOptions }): value is SheetAdminContext {
  return "guild" in value && "settings" in value;
}
