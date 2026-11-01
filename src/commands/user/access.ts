import type { ChatInputCommandInteraction } from "discord.js";
import { isOrganiser } from "../../lib/permissions.js";
import { respondUser } from "./respond.js";
import { userErrorMessage } from "./view.js";
import { loadGuildConfig } from "../../lib/guild-config.js";

async function loadStaff(guildId: string) {
  try {
    return (await loadGuildConfig(guildId)).staff;
  } catch {
    return null;
  }
}

export async function requireUserOrganiser(
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

  await respondUser(
    interaction,
    userErrorMessage(
      "Organiser required",
      `Only an **Organiser** (manager role) or a Discord **Administrator** can ${action}.`,
    ),
  );
  return false;
}
