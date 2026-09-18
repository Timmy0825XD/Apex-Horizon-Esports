export type EmbedFieldDraft = {
  name: string;
  value: string;
  inline: boolean;
};

export type EmbedDraft = {
  title?: string;
  description?: string;
  color?: number;
  authorName?: string;
  authorIcon?: string;
  authorUrl?: string;
  footerText?: string;
  footerIcon?: string;
  thumbnail?: string;
  image?: string;
  timestampMs?: number;
  fields: EmbedFieldDraft[];
};

export type V2Block =
  | { type: "text"; content: string }
  | { type: "section"; heading: string; extra?: string; thumbnail?: string }
  | { type: "separator" }
  | { type: "media"; url: string };

export type V2Draft = {
  accentColor?: number;
  blocks: V2Block[];
};

type SessionBase = {
  userId: string;
  guildId: string;
  channelId: string;
  edit?: { channelId: string; messageId: string };
  expiresAt: number;
};

export type EmbedSession = SessionBase & { kind: "embed"; draft: EmbedDraft };
export type V2Session = SessionBase & { kind: "v2"; draft: V2Draft };
export type UtilitySession = EmbedSession | V2Session;

const TTL_MS = 15 * 60 * 1000;
const sessions = new Map<string, UtilitySession>();

export function sessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getSession(guildId: string, userId: string): UtilitySession | null {
  const key = sessionKey(guildId, userId);
  const session = sessions.get(key);
  if (!session) {
    return null;
  }
  if (session.expiresAt < Date.now()) {
    sessions.delete(key);
    return null;
  }
  return session;
}

export function saveSession<T extends UtilitySession>(session: T): T {
  session.expiresAt = Date.now() + TTL_MS;
  sessions.set(sessionKey(session.guildId, session.userId), session);
  return session;
}

export function clearSession(guildId: string, userId: string): void {
  sessions.delete(sessionKey(guildId, userId));
}

export function requireSession<K extends UtilitySession["kind"]>(
  guildId: string,
  userId: string,
  kind: K,
): Extract<UtilitySession, { kind: K }> | null {
  const session = getSession(guildId, userId);
  if (!session || session.kind !== kind) {
    return null;
  }
  return session as Extract<UtilitySession, { kind: K }>;
}

export const MAX_V2_BLOCKS = 15;
export const MAX_EMBED_FIELDS = 25;
