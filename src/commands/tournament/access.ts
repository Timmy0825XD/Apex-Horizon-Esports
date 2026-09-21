import type { GuildSettings, StaffConfig } from "@prisma/client";
import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Guild, InteractionReplyOptions } from "discord.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { loadGuildSettings } from "../settings/store.js";
import { respondTournament } from "./respond.js";
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

async function loadStaff(guildId: string): Promise<StaffConfig | null> {
  try {
    const guild = await prisma.guild.findUnique({
      where: { guildId },
      select: { staff: true },
    });
    return guild?.staff ?? null;
  } catch {
    return null;
  }
}

export async function canUseTournamentRole(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction | ButtonInteraction,
): Promise<boolean> {
  if (!interaction.guildId) {
    return false;
  }
  const staff = await loadStaff(interaction.guildId);
  return isOrganiser(interaction, staff);
}

export async function requireOrganiser(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  action: string,
): Promise<boolean> {
  if (await canUseTournamentRole(interaction)) {
    return true;
  }

  await respondTournament(
    interaction,
    tournamentErrorMessage(
      "Organiser required",
      `Only an **Organiser** (manager role) or a Discord **Administrator** can ${action}.`,
    ),
  );
  return false;
}
