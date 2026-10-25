import type { GuildSettings } from "@prisma/client";
import { loadStaffConfig } from "./organiser.js";
import { isGuildAdmin, isOrganiser, memberHasRole, type PermissionInteraction } from "./permissions.js";
import { prisma } from "./prisma.js";

export type AccessRoles = {
  admin?: boolean;
  organiser?: boolean;
  helper?: boolean;
  staff?: boolean;
  judge?: boolean;
  recorder?: boolean;
};

async function loadSettings(guildId: string): Promise<GuildSettings | null> {
  try {
    const guild = await prisma.guild.findUnique({
      where: { guildId },
      select: { settings: true },
    });
    return guild?.settings ?? null;
  } catch {
    return null;
  }
}

async function hasTournamentHelperRole(interaction: PermissionInteraction, guildId: string): Promise<boolean> {
  const tournaments = await prisma.tournament.findMany({
    where: { guildId },
    select: { helperRoleId: true },
  });
  return tournaments.some((row) => row.helperRoleId.length > 0 && memberHasRole(interaction, row.helperRoleId));
}

/** Role checklist from `context/commands/access.md`. A marked role is enough. */
export async function actorMatches(interaction: PermissionInteraction, roles: AccessRoles): Promise<boolean> {
  const guildId = interaction.guildId;
  if (!guildId) {
    return false;
  }

  const [settings, staff] = await Promise.all([
    roles.admin ? loadSettings(guildId) : Promise.resolve(null),
    roles.organiser || roles.staff || roles.judge || roles.recorder ? loadStaffConfig(guildId) : Promise.resolve(null),
  ]);

  if (roles.admin && isGuildAdmin(interaction, settings)) {
    return true;
  }
  if (roles.organiser && isOrganiser(interaction, staff)) {
    return true;
  }
  if (roles.staff && staff && memberHasRole(interaction, staff.staffRoleId)) {
    return true;
  }
  if (roles.judge && staff && memberHasRole(interaction, staff.judgeRoleId)) {
    return true;
  }
  if (roles.recorder && staff && memberHasRole(interaction, staff.recorderRoleId)) {
    return true;
  }
  if (roles.helper && (await hasTournamentHelperRole(interaction, guildId))) {
    return true;
  }
  return false;
}
