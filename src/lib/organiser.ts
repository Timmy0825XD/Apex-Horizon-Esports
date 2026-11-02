import type { StaffConfig } from "@prisma/client";
import { isOrganiser, type PermissionInteraction } from "./permissions.js";
import { loadGuildConfig } from "./guild-config.js";

export async function loadStaffConfig(guildId: string): Promise<StaffConfig | null> {
  try {
    return (await loadGuildConfig(guildId)).staff;
  } catch {
    return null;
  }
}

export async function memberIsOrganiser(
  interaction: PermissionInteraction,
): Promise<boolean> {
  if (!interaction.guildId) {
    return false;
  }
  const staff = await loadStaffConfig(interaction.guildId);
  return isOrganiser(interaction, staff);
}
