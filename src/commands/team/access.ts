import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import { isOrganiser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { respondTeam } from "./respond.js";
import { teamErrorMessage } from "./view.js";

async function loadStaff(guildId: string) {
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

export async function canUseTeamCommands(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): Promise<boolean> {
  if (!interaction.guildId) {
    return false;
  }
  const staff = await loadStaff(interaction.guildId);
  return isOrganiser(interaction, staff);
}

export async function requireTeamOrganiser(
  interaction: ChatInputCommandInteraction,
  action: string,
): Promise<boolean> {
  if (await canUseTeamCommands(interaction)) {
    return true;
  }

  await respondTeam(
    interaction,
    teamErrorMessage(
      "Organiser required",
      `Only an **Organiser** (manager role) or a Discord **Administrator** can ${action}.`,
    ),
  );
  return false;
}
