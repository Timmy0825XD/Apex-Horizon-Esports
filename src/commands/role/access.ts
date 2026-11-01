import type { ChatInputCommandInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
import { isOrganiser } from "../../lib/permissions.js";
import { respondRole } from "./respond.js";
import { roleErrorMessage } from "./view.js";
import { loadGuildConfig } from "../../lib/guild-config.js";

async function loadStaff(guildId: string) {
  try {
    return (await loadGuildConfig(guildId)).staff;
  } catch {
    return null;
  }
}

export async function requireRoleAdmin(
  interaction: ChatInputCommandInteraction,
  action: string,
): Promise<boolean> {
  if (await actorMatches(interaction, { admin: true })) {
    return true;
  }

  await respondRole(
    interaction,
    roleErrorMessage("Admin required", `You need **Admin** to ${action}.`),
  );
  return false;
}

export async function requireRoleOrganiser(
  interaction: ChatInputCommandInteraction,
  action: string,
): Promise<boolean> {
  if (!interaction.guildId) {
    return false;
  }

  const staff = await loadStaff(interaction.guildId);
  if (isOrganiser(interaction, staff)) {
    return true;
  }

  await respondRole(
    interaction,
    roleErrorMessage(
      "Organiser required",
      `Only an **Organiser** (manager role) or a Discord **Administrator** can ${action}.`,
    ),
  );
  return false;
}
