import { PermissionFlagsBits, type GuildMember, type PermissionResolvable } from "discord.js";

type PermHolder = { memberPermissions?: { has(permission: PermissionResolvable): boolean } | null };

type ChannelWithPerms = {
  guild: { members: { me: GuildMember | null } };
  permissionsFor(member: GuildMember): { has(permission: PermissionResolvable): boolean } | null;
};

export function memberHasPermission(interaction: PermHolder, permission: PermissionResolvable): boolean {
  return interaction.memberPermissions?.has(permission) ?? false;
}

export function botHasChannelPermission(channel: ChannelWithPerms, permission: PermissionResolvable): boolean {
  const me = channel.guild.members.me;
  if (!me) {
    return false;
  }
  return channel.permissionsFor(me)?.has(permission) ?? false;
}

export function canManageMessages(interaction: PermHolder): boolean {
  return memberHasPermission(interaction, PermissionFlagsBits.ManageMessages);
}

export function canManageExpressions(interaction: PermHolder): boolean {
  return memberHasPermission(interaction, PermissionFlagsBits.ManageGuildExpressions);
}

export function canClearCategory(interaction: PermHolder): boolean {
  return memberHasPermission(interaction, PermissionFlagsBits.Administrator);
}
