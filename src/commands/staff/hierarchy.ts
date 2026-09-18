import {
  GuildMember,
  PermissionFlagsBits,
  type APIInteractionGuildMember,
  type Guild,
  type Role,
} from "discord.js";
import { formatRoleFromRole } from "../../lib/formatters.js";

export async function fetchActor(
  guild: Guild,
  userId: string,
  member: GuildMember | APIInteractionGuildMember | null,
): Promise<GuildMember> {
  if (member instanceof GuildMember) {
    return member;
  }
  return guild.members.fetch(userId);
}

export function botCanManageRoles(botMember: GuildMember): boolean {
  return botMember.permissions.has(PermissionFlagsBits.ManageRoles);
}

export function actorCanManageMember(actor: GuildMember, target: GuildMember): boolean {
  if (actor.id === actor.guild.ownerId) {
    return true;
  }
  if (target.id === target.guild.ownerId) {
    return false;
  }
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

export function unmanageableRoleReason(role: Role, actor: GuildMember, botMember: GuildMember): string | null {
  const mention = formatRoleFromRole(role);
  if (role.managed) {
    return `${mention} is managed by an integration and cannot be assigned.`;
  }
  if (role.position >= botMember.roles.highest.position) {
    return `My highest role is not above ${mention}.`;
  }
  if (actor.id !== actor.guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) {
    return `Your highest role is not above ${mention}.`;
  }
  return null;
}
