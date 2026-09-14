import type { Guild, GuildMember, Role, User } from "discord.js";

export function formatRole(_guild: Guild | null, roleId: string): string {
  return `<@&${roleId}>`;
}

export function formatRoleFromRole(role: Role): string {
  return `<@&${role.id}>`;
}

export function formatChannel(_guild: Guild | null, channelId: string): string {
  return `<#${channelId}>`;
}

export function formatCategory(_guild: Guild | null, categoryId: string): string {
  return `<#${categoryId}>`;
}

export function formatUser(userId: string): string {
  return `<@${userId}>`;
}

export function formatUserFromUser(user: User): string {
  return `<@${user.id}>`;
}

export function formatMember(member: GuildMember): string {
  return `<@${member.id}>`;
}

export function formatHelpEntry(commandPath: string, commandId?: string): string {
  if (commandId) {
    return `</${commandPath}:${commandId}>`;
  }
  return `\`/${commandPath}\``;
}
