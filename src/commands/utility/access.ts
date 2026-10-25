import { type GuildMember, type PermissionResolvable } from "discord.js";

type ChannelWithPerms = {
  guild: { members: { me: GuildMember | null } };
  permissionsFor(member: GuildMember): { has(permission: PermissionResolvable): boolean } | null;
};

export function botHasChannelPermission(channel: ChannelWithPerms, permission: PermissionResolvable): boolean {
  const me = channel.guild.members.me;
  if (!me) {
    return false;
  }
  return channel.permissionsFor(me)?.has(permission) ?? false;
}
