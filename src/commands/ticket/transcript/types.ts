export interface TranscriptAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  color: string | null;
  bot: boolean;
}

export interface TranscriptAttachment {
  id: string;
  name: string;
  url: string;
  description: string | null;
  contentType: string | null;
  size: number;
  width: number | null;
  height: number | null;
  image: boolean;
}

export interface TranscriptReaction {
  key: string;
  label: string;
  imageUrl: string | null;
  count: number;
  reactedByBot: boolean;
}

export interface TranscriptSticker {
  id: string;
  name: string;
  description: string | null;
  url: string;
}

export interface TranscriptInteraction {
  id: string;
  name: string;
  userId: string;
  userName: string;
  type: number;
}

export interface TranscriptReply {
  messageId: string;
  authorName: string | null;
  content: string | null;
}

export interface TranscriptForward {
  createdAt: string | null;
  content: string;
  embeds: unknown[];
  components: unknown[];
  attachments: TranscriptAttachment[];
  stickers: TranscriptSticker[];
}

export interface TranscriptMessage {
  id: string;
  type: number;
  createdAt: string;
  editedAt: string | null;
  content: string;
  author: TranscriptAuthor;
  attachments: TranscriptAttachment[];
  embeds: unknown[];
  components: unknown[];
  reactions: TranscriptReaction[];
  stickers: TranscriptSticker[];
  interaction: TranscriptInteraction | null;
  reply: TranscriptReply | null;
  forwards: TranscriptForward[];
}

export interface TranscriptMentionMaps {
  users: Record<string, string>;
  roles: Record<string, { name: string; color: string | null }>;
  channels: Record<string, string>;
}

export interface TranscriptSnapshot {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  channelTopic: string | null;
  generatedAt: string;
  messages: TranscriptMessage[];
  mentions: TranscriptMentionMaps;
}

export interface EmbeddedAsset {
  sourceUrl: string;
  renderedUrl: string;
}

export interface RenderedTranscriptPage {
  filename: string;
  html: string;
  firstMessage: number;
  lastMessage: number;
}
