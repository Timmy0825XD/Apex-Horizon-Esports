import { MessageReferenceType, type Attachment, type Message, type Sticker, type TextChannel } from "discord.js";
import type {
  TranscriptAttachment,
  TranscriptForward,
  TranscriptInteraction,
  TranscriptMentionMaps,
  TranscriptMessage,
  TranscriptReply,
  TranscriptSnapshot,
  TranscriptSticker,
} from "./types.js";

const PAGE_SIZE = 100;
const FETCH_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(ticket: TextChannel, before?: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await ticket.messages.fetch({ limit: PAGE_SIZE, before, cache: false });
    } catch (error) {
      lastError = error;
      if (attempt + 1 < FETCH_ATTEMPTS) {
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Discord did not return the ticket messages.");
}

async function fetchAllMessages(ticket: TextChannel): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;

  for (;;) {
    const page = await fetchPage(ticket, before);
    if (page.size === 0) {
      break;
    }
    const batch = [...page.values()];
    messages.push(...batch);
    const oldest = batch.reduce((current, message) => (BigInt(message.id) < BigInt(current.id) ? message : current));
    if (page.size < PAGE_SIZE || oldest.id === before) {
      break;
    }
    before = oldest.id;
  }

  return messages.sort((left, right) => {
    if (left.createdTimestamp !== right.createdTimestamp) {
      return left.createdTimestamp - right.createdTimestamp;
    }
    return left.id.localeCompare(right.id);
  });
}

function interactionOf(message: Message): TranscriptInteraction | null {
  const command = message.interaction;
  const metadata = message.interactionMetadata;
  const name = command?.commandName.trim();
  const id = command?.id ?? metadata?.id;
  const user = command?.user ?? metadata?.user;
  if (!name || !id || !user) {
    return null;
  }
  return {
    id,
    name,
    userId: user.id,
    userName: user.displayName ?? user.globalName ?? user.username,
    type: command?.type ?? metadata?.type ?? 0,
  };
}

function replyOf(message: Message, byId: Map<string, Message>): TranscriptReply | null {
  if (message.reference?.type === MessageReferenceType.Forward) {
    return null;
  }
  const messageId = message.reference?.messageId;
  if (!messageId) {
    return null;
  }
  const referenced = byId.get(messageId);
  return {
    messageId,
    authorName: referenced
      ? (referenced.member?.displayName ?? referenced.author.globalName ?? referenced.author.username)
      : null,
    content: referenced?.content?.slice(0, 300) || null,
  };
}

function addMentions(message: Message, maps: TranscriptMentionMaps): void {
  for (const user of message.mentions.users.values()) {
    maps.users[user.id] = user.globalName ?? user.username;
  }
  for (const member of message.mentions.members?.values() ?? []) {
    maps.users[member.id] = member.displayName;
  }
  for (const role of message.mentions.roles.values()) {
    maps.roles[role.id] = {
      name: role.name,
      color: role.color ? role.hexColor : null,
    };
  }
  for (const channel of message.mentions.channels.values()) {
    if ("name" in channel && typeof channel.name === "string") {
      maps.channels[channel.id] = channel.name;
    }
  }
}

function isAudiovisual(name: string, contentType: string | null): boolean {
  const mime = contentType?.toLowerCase() ?? "";
  return mime.startsWith("audio/") || mime.startsWith("video/") || /\.(?:mp3|wav|ogg|m4a|flac|mp4|webm|mov|mkv)$/i.test(name);
}

function attachmentOf(attachment: Attachment): TranscriptAttachment | null {
  if (isAudiovisual(attachment.name, attachment.contentType)) {
    return null;
  }
  return {
    id: attachment.id,
    name: attachment.name,
    url: attachment.url,
    description: attachment.description,
    contentType: attachment.contentType,
    size: attachment.size,
    width: attachment.width,
    height: attachment.height,
    image: Boolean(
      attachment.contentType?.toLowerCase().startsWith("image/") ||
        /\.(?:avif|gif|jpe?g|png|webp)$/i.test(attachment.name),
    ),
  };
}

function stickerOf(sticker: Sticker): TranscriptSticker {
  return {
    id: sticker.id,
    name: sticker.name,
    description: sticker.description,
    url: sticker.url,
  };
}

function forwardsOf(message: Message): TranscriptForward[] {
  if (message.reference?.type !== MessageReferenceType.Forward) {
    return [];
  }
  const snapshots = [...message.messageSnapshots.values()];
  if (snapshots.length === 0) {
    return [
      {
        createdAt: null,
        content: "",
        embeds: [],
        components: [],
        attachments: [],
        stickers: [],
      },
    ];
  }
  return snapshots.map((snapshot) => ({
    createdAt: snapshot.createdTimestamp ? new Date(snapshot.createdTimestamp).toISOString() : null,
    content: snapshot.content,
    embeds: snapshot.embeds.map((embed) => embed.toJSON()),
    components: snapshot.components.map((component) => component.toJSON()),
    attachments: [...snapshot.attachments.values()].flatMap((attachment) => {
      const mapped = attachmentOf(attachment);
      return mapped ? [mapped] : [];
    }),
    stickers: [...snapshot.stickers.values()].map(stickerOf),
  }));
}

function snapshotMessage(message: Message, byId: Map<string, Message>): TranscriptMessage {
  const memberColor = message.member?.displayColor ?? 0;
  return {
    id: message.id,
    type: message.type,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
      avatarUrl: message.author.displayAvatarURL({ extension: "png", size: 128 }),
      color: memberColor ? `#${memberColor.toString(16).padStart(6, "0")}` : null,
      bot: message.author.bot,
    },
    attachments: [...message.attachments.values()].flatMap((attachment) => {
      const mapped = attachmentOf(attachment);
      return mapped ? [mapped] : [];
    }),
    embeds: message.embeds.map((embed) => embed.toJSON()),
    components: message.components.map((component) => component.toJSON()),
    reactions: [...message.reactions.cache.values()].map((reaction) => ({
      key: reaction.emoji.id ?? reaction.emoji.name ?? "reaction",
      label: reaction.emoji.name ?? "reaction",
      imageUrl: reaction.emoji.imageURL({ size: 32 }) ?? null,
      count: reaction.count,
      reactedByBot: reaction.me,
    })),
    stickers: [...message.stickers.values()].map(stickerOf),
    interaction: interactionOf(message),
    reply: replyOf(message, byId),
    forwards: forwardsOf(message),
  };
}

export async function collectTicketSnapshot(ticket: TextChannel): Promise<TranscriptSnapshot> {
  const messages = await fetchAllMessages(ticket);
  const byId = new Map(messages.map((message) => [message.id, message]));
  const mentions: TranscriptMentionMaps = { users: {}, roles: {}, channels: {} };

  for (const role of ticket.guild.roles.cache.values()) {
    mentions.roles[role.id] = { name: role.name, color: role.color ? role.hexColor : null };
  }
  for (const channel of ticket.guild.channels.cache.values()) {
    if ("name" in channel && typeof channel.name === "string") {
      mentions.channels[channel.id] = channel.name;
    }
  }
  for (const message of messages) {
    mentions.users[message.author.id] =
      message.member?.displayName ?? message.author.globalName ?? message.author.username;
    addMentions(message, mentions);
  }

  return {
    guildId: ticket.guild.id,
    guildName: ticket.guild.name,
    channelId: ticket.id,
    channelName: ticket.name,
    channelTopic: ticket.topic,
    generatedAt: new Date().toISOString(),
    messages: messages.map((message) => snapshotMessage(message, byId)),
    mentions,
  };
}
