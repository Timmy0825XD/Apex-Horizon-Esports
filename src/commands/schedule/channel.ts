import {
  ChannelType,
  type Guild,
  type NewsChannel,
  type TextChannel,
} from "discord.js";

const MARK = "🔴";

const CHAT = {
  ViewChannel: true,
  SendMessages: true,
  EmbedLinks: true,
  AttachFiles: true,
  ReadMessageHistory: true,
  AddReactions: true,
  UseExternalEmojis: true,
} as const;

export async function textChannel(guild: Guild, channelId: string): Promise<TextChannel | NewsChannel | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return null;
  }
  return channel;
}

export async function ticketChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
  const channel = await textChannel(guild, channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return null;
  }
  return channel;
}

export function markedName(name: string): string {
  const bare = name.replace(/^🔴+/, "");
  return `${MARK}${bare}`.slice(0, 100);
}

export function unmarkedName(name: string): string {
  const bare = name.replace(/^🔴+/, "");
  return bare || "ticket";
}

export async function markTicket(channel: TextChannel): Promise<void> {
  const next = markedName(channel.name);
  if (channel.name !== next) {
    await channel.setName(next, "Schedule is live");
  }
}

export async function unmarkTicket(channel: TextChannel): Promise<void> {
  const next = unmarkedName(channel.name);
  if (channel.name !== next) {
    await channel.setName(next, "Schedule removed");
  }
}

export async function grantTicket(channel: TextChannel, userId: string): Promise<void> {
  await channel.permissionOverwrites.edit(userId, CHAT, { reason: "Schedule staff" });
}

export async function revokeTicket(channel: TextChannel, userId: string, stillSeated: boolean): Promise<void> {
  if (stillSeated) {
    return;
  }
  await channel.permissionOverwrites.delete(userId, "Left the schedule").catch(() => undefined);
}
