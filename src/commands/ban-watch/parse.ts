/**
 * Reads a ban announcement. The official posts change shape every time, so only two things are trusted:
 * Discord IDs (17-20 digits) and whether the post is an unban. A "Reason" line is used when there is one.
 */

export type AnnouncementKind = "ban" | "unban";

export type AnnouncedId = {
  userId: string;
  reason: string | null;
};

export type Announcement = {
  kind: AnnouncementKind;
  ids: AnnouncedId[];
};

const REASON_MAX = 300;

/** Remove every token that carries a snowflake but is not a person: roles, channels, emojis, timestamps, links. */
function scrub(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<@&\d+>/g, " ")
    .replace(/<#\d+>/g, " ")
    .replace(/<a?:\w+:\d+>/g, " ")
    .replace(/<t:\d+(?::\w)?>/g, " ")
    .replace(/<@!?(\d+)>/g, " $1 ");
}

export function isUnbanAnnouncement(text: string): boolean {
  return /\bun-?\s?ban(?:ned)?\b/i.test(text);
}

export function parseAnnouncement(raw: string): Announcement {
  const text = scrub(raw);
  const reasons = [...text.matchAll(/reason\s*[:\-–]\s*([^\n]+)/gi)].map((match) => ({
    at: match.index ?? 0,
    text: match[1].trim().slice(0, REASON_MAX) || null,
  }));

  const seen = new Set<string>();
  const ids: AnnouncedId[] = [];
  for (const match of text.matchAll(/(?<!\d)\d{17,20}(?!\d)/g)) {
    const userId = match[0];
    if (seen.has(userId)) {
      continue;
    }
    seen.add(userId);
    const at = match.index ?? 0;
    // The reason that follows the ID belongs to it; posts with one reason for several IDs put it last.
    const after = reasons.find((reason) => reason.at > at);
    const before = [...reasons].reverse().find((reason) => reason.at < at);
    ids.push({ userId, reason: (after ?? before)?.text ?? null });
  }

  return { kind: isUnbanAnnouncement(text) ? "unban" : "ban", ids };
}

/** Text of a message as the reader sees it: content plus any embed text. */
export function announcementText(message: {
  content: string;
  embeds: Array<{
    title: string | null;
    description: string | null;
    fields: Array<{ name: string; value: string }>;
    footer: { text: string } | null;
  }>;
}): string {
  const parts = [message.content];
  for (const embed of message.embeds) {
    parts.push(embed.title ?? "", embed.description ?? "");
    for (const field of embed.fields) {
      parts.push(`${field.name}\n${field.value}`);
    }
    parts.push(embed.footer?.text ?? "");
  }
  return parts.filter((part) => part.trim()).join("\n");
}
