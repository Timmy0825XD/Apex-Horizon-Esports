import { PermissionFlagsBits, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import type { GuildSettings, StaffConfig } from "@prisma/client";

type PermissionInteraction = ChatInputCommandInteraction | AutocompleteInteraction;

export function isDiscordAdministrator(interaction: PermissionInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

export function memberHasRole(interaction: PermissionInteraction, roleId: string): boolean {
  const roles = interaction.member?.roles;
  if (!roles) {
    return false;
  }
  if ("cache" in roles) {
    return roles.cache.has(roleId);
  }
  return roles.includes(roleId);
}

export function isGuildAdmin(interaction: ChatInputCommandInteraction, settings: GuildSettings | null): boolean {
  if (isDiscordAdministrator(interaction)) {
    return true;
  }
  return settings != null && memberHasRole(interaction, settings.adminRoleId);
}

export function isOrganiser(interaction: PermissionInteraction, staff: StaffConfig | null): boolean {
  if (isDiscordAdministrator(interaction)) {
    return true;
  }
  return staff != null && memberHasRole(interaction, staff.managerRoleId);
}
