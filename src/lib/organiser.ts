import type { StaffConfig } from "@prisma/client";
import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { isOrganiser } from "./permissions.js";
import { prisma } from "./prisma.js";

export async function loadStaffConfig(guildId: string): Promise<StaffConfig | null> {
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

export async function memberIsOrganiser(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction | ButtonInteraction,
): Promise<boolean> {
  if (!interaction.guildId) {
    return false;
  }
  const staff = await loadStaffConfig(interaction.guildId);
  return isOrganiser(interaction, staff);
}
