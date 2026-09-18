import {
  ChannelType,
  type Guild,
  type Message,
  type NewsChannel,
  type TextBasedChannel,
  type TextChannel,
} from "discord.js";

export type PostChannel = TextChannel | NewsChannel;

export function isPostChannel(channel: { type: ChannelType } | null | undefined): channel is PostChannel {
  return channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement;
}

export function currentPostChannel(channel: TextBasedChannel | null): PostChannel | null {
  return isPostChannel(channel) ? channel : null;
}

export async function fetchPostChannel(guild: Guild, channelId: string): Promise<PostChannel | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return isPostChannel(channel) ? channel : null;
}

export async function fetchGuildMessage(
  guild: Guild,
  channelId: string,
  messageId: string,
): Promise<{ channel: PostChannel; message: Message } | string> {
  const channel = await fetchPostChannel(guild, channelId);
  if (!channel) {
    return "I can only read messages in a text or announcement channel.";
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    return `I could not find message \`${messageId}\` in that channel.`;
  }
  return { channel, message };
}

export function isBotMessage(message: Message, botId: string | undefined): boolean {
  return Boolean(botId) && message.author.id === botId;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
