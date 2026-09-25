import type { ButtonInteraction, ChatInputCommandInteraction, Guild, GuildMember } from "discord.js";
import type { StaffInput } from "../staff/fields.js";
import type { TournamentRecord } from "../tournament/fields.js";

type RoleInteraction = ChatInputCommandInteraction | ButtonInteraction;

function memberRoles(interaction: RoleInteraction): string[] {
  const member = interaction.member;
  if (!member || typeof member === "string" || !("roles" in member)) {
    return [];
  }
  const roles = member.roles;
  if (Array.isArray(roles)) {
    return roles;
  }
  return [...roles.cache.keys()];
}

export function hasRole(interaction: RoleInteraction, roleId: string): boolean {
  return memberRoles(interaction).includes(roleId);
}

export function isTournamentAdminOrHelper(interaction: RoleInteraction, tournament: TournamentRecord): boolean {
  return hasRole(interaction, tournament.adminRoleId) || hasRole(interaction, tournament.helperRoleId);
}

export function isStaff(interaction: RoleInteraction, staff: StaffInput): boolean {
  return hasRole(interaction, staff.staffRoleId);
}

export function isJudge(interaction: RoleInteraction, staff: StaffInput): boolean {
  return hasRole(interaction, staff.judgeRoleId);
}

export function isRecorder(interaction: RoleInteraction, staff: StaffInput): boolean {
  return hasRole(interaction, staff.recorderRoleId);
}

export async function memberHasRole(guild: Guild, userId: string, roleId: string): Promise<boolean> {
  const member = await guild.members.fetch(userId).catch(() => null);
  return Boolean(member?.roles.cache.has(roleId));
}

export function memberId(interaction: RoleInteraction): string | null {
  const member = interaction.member;
  if (!member) {
    return interaction.user.id;
  }
  if (typeof member === "string") {
    return null;
  }
  return (member as GuildMember).id;
}
