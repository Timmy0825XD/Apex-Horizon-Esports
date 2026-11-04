import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord, stageLabel } from "../room/labels.js";

/** Colour says what happened: blue informs, green confirms, gold waits, orange warns, red removes or fails. */
export type CardTone = "info" | "success" | "pending" | "warning" | "danger" | "error";

export const toneColor: Record<CardTone, number> = {
  info: 0x3498db,
  success: 0x23a55a,
  pending: 0xf0b232,
  warning: 0xe67e22,
  danger: embedColors.error,
  error: embedColors.error,
};

const toneEmoji: Record<CardTone, string> = {
  info: emojis.info,
  success: emojis.success,
  pending: emojis.calendar,
  warning: emojis.alert,
  danger: emojis.error,
  error: emojis.error,
};

/** A card block: text, a divider, a section with its own button, a row of buttons, or an image gallery. */
export type CardBlock = string | "divider" | SectionBuilder | ActionRowBuilder<ButtonBuilder> | { gallery: string[] };

export function scheduleCard(input: {
  tone: CardTone;
  title: string;
  emoji?: string;
  eyebrow?: string | null;
  blocks?: CardBlock[];
  footer?: string | null;
}): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(toneColor[input.tone]);
  // `emoji: ""` drops the icon; leaving it out uses the tone's emoji.
  const icon = input.emoji ?? toneEmoji[input.tone];
  const heading = icon ? `## ${icon} ${input.title}` : `## ${input.title}`;
  container.addTextDisplayComponents(textBlock(input.eyebrow ? `-# ${input.eyebrow}\n${heading}` : heading));
  for (const block of input.blocks ?? []) {
    if (block === "divider") {
      container.addSeparatorComponents(divider());
    } else if (typeof block === "string") {
      if (block.trim()) container.addTextDisplayComponents(textBlock(block));
    } else if (block instanceof SectionBuilder) {
      container.addSectionComponents(block);
    } else if ("gallery" in block) {
      if (block.gallery.length) {
        container.addMediaGalleryComponents((gallery) => {
          for (const url of block.gallery.slice(0, 10)) gallery.addItems((item) => item.setURL(url));
          return gallery;
        });
      }
    } else {
      container.addActionRowComponents(block);
    }
  }
  if (input.footer) {
    container.addTextDisplayComponents(textBlock(`-# ${input.footer}`));
  }
  return container;
}

export function cardPayload(container: ContainerBuilder, mentionUserIds: string[] = []): InteractionReplyOptions {
  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: mentionUserIds.length ? { users: mentionUserIds, parse: [] } : { parse: [] },
  };
}

/** Errors and short notices of every `/schedule` interaction. */
export function scheduleNotice(kind: "error" | "success" | "info" | "warning", title: string, body: string): InteractionReplyOptions {
  return cardPayload(scheduleCard({ tone: kind, title, blocks: [body] }));
}

/**
 * The success replies of `/schedule create` and `/schedule update` keep their original look on purpose.
 * Everything else uses {@link scheduleNotice}.
 */
export function legacyNotice(kind: "error" | "success" | "info", title: string, body: string): InteractionReplyOptions {
  const emoji = kind === "error" ? emojis.error : kind === "success" ? emojis.success : emojis.info;
  const color = kind === "error" ? embedColors.error : kind === "success" ? embedColors.success : embedColors.info;
  return {
    components: [new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(textBlock(`# ${emoji} ${title}`), textBlock(body))],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

// ---------- shared copy ----------

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `04/11 21:00 UTC` */
export function shortUtc(when: Date): string {
  return `${pad(when.getUTCDate())}/${pad(when.getUTCMonth() + 1)} ${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())} UTC`;
}

/** `Rakshasa · Group B · Round 2` */
export function matchEyebrow(tournamentName: string, match: { group: string | null; round: number | null } | null): string {
  const stage = stageLabel(match);
  return stage ? `${escapeDiscord(tournamentName)} · ${stage}` : escapeDiscord(tournamentName);
}

/** `**Apex Wolves vs Nova Rising**` */
export function matchName(leftName: string, rightName: string): string {
  return `**${escapeDiscord(leftName)} vs ${escapeDiscord(rightName)}**`;
}

/** `Deleted by @user · <time>`; without a user, only the time. */
export function stampFooter(verb: string | null, userId?: string | null, at = new Date()): string {
  const time = `<t:${Math.floor(at.getTime() / 1000)}:f>`;
  return verb && userId ? `${verb} by ${formatUser(userId)} · ${time}` : time;
}

export function seatName(seat: "judge" | "recorder"): string {
  return seat === "judge" ? "Judge" : "Recorder";
}

export function seatEmoji(seat: "judge" | "recorder"): string {
  return seat === "judge" ? emojis.judge : emojis.recorder;
}

/** `⚖ @Valen · 🎥 Open` */
export function staffInline(judgeId: string | null, recorderId: string | null): string {
  const one = (seat: "judge" | "recorder", userId: string | null) => `${seatEmoji(seat)} ${userId ? formatUser(userId) : "*Open*"}`;
  return `${one("judge", judgeId)} · ${one("recorder", recorderId)}`;
}

export function linkButton(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url).setEmoji(customEmoji(emojis.link));
}

export function channelUrl(guildId: string, channelId: string, messageId?: string | null): string {
  return `https://discord.com/channels/${guildId}/${channelId}${messageId ? `/${messageId}` : ""}`;
}

export function quote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${escapeDiscord(line)}`)
    .join("\n");
}

// ---------- reply ----------

function usesV2(payload: InteractionReplyOptions): boolean {
  const flags = payload.flags;
  if (flags == null) {
    return false;
  }
  if (typeof flags === "number") {
    return (flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2;
  }
  if (Array.isArray(flags)) {
    return flags.includes(MessageFlags.IsComponentsV2);
  }
  return false;
}

export async function replySchedule(interaction: ChatInputCommandInteraction, payload: InteractionReplyOptions): Promise<void> {
  const allowedMentions = payload.allowedMentions ?? { parse: [] };
  const v2 = usesV2(payload);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: v2 ? null : (payload.content ?? null),
      embeds: v2 ? [] : (payload.embeds ?? []),
      components: payload.components ?? [],
      files: payload.files,
      allowedMentions,
      flags: v2 ? v2Flags : undefined,
    });
    return;
  }
  await interaction.reply({ ...payload, allowedMentions });
}
