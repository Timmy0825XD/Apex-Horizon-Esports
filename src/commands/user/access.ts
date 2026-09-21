import type { ChatInputCommandInteraction } from "discord.js";
import { isOrganiser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { respondUser } from "./respond.js";
import { userErrorMessage } from "./view.js";

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
