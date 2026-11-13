import {
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type Guild,
  type NewsChannel,
  type TextChannel,
  type User,
  type Webhook,
} from "discord.js";
import { emojis } from "../emojis.js";
import { formatUserFromUser } from "./formatters.js";
import { silenceChannel } from "./mentions.js";

/**
 * Each module signs its logs with its own name (the webhook's visible name is the log type).
 * The card title is the action, so the name never repeats inside the card.
 */
export const auditModules = {
  serverConfig: { name: "Server Config", emoji: emojis.settings },
  staff: { name: "Staff", emoji: emojis.members },
  moderation: { name: "Moderation", emoji: emojis.banned },
  tournaments: { name: "Tournaments", emoji: emojis.torneo },
  rooms: { name: "Rooms", emoji: emojis.channels },
  schedules: { name: "Schedules", emoji: emojis.calendar },
  attendance: { name: "Attendance", emoji: emojis.judge_recorder },
  utility: { name: "Utility", emoji: emojis.creation },
  ticketSystem: { name: "Ticket System", emoji: emojis.open_close },
  challonge: { name: "Challonge Logs", emoji: emojis.challonge },
  scoreUpload: { name: "Score Upload", emoji: emojis.scoreboard },
} as const;

export type AuditModule = keyof typeof auditModules;

/**
 * Mutations are audited; the stripe color tells which kind. `blocked` is the one exception: an attempt
 * the bot refused because it looks like cheating (e.g. Assign pressed through the API while disabled).
 */
export type AuditAction = "created" | "updated" | "deleted" | "blocked";

const actionColors: Record<AuditAction, number> = {
  created: 0x3fae6a,
  updated: 0xd9ad45,
  deleted: 0xd8453d,
  blocked: 0x8e5bd6,
};

/** A block of the card. `label` prints as a small caption; `inline` joins the lines with " · ". */
export type AuditGroup = {
  label?: string;
  lines: string[];
  inline?: boolean;
};

export type AuditPayload = {
  guild: Guild;
  channelId: string;
  module: AuditModule;
  action: AuditAction;
  title: string;
  summary: string;
  groups?: AuditGroup[];
  actor: User;
};

// Components V2 caps the text of one message at 4000 characters.
const TEXT_BUDGET = 3800;
const LINE_MAX = 900;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function groupText(group: AuditGroup): string {
  const lines = group.lines.filter((line) => line.trim()).map((line) => clip(line, LINE_MAX));
  if (lines.length === 0) {
    return "";
  }
  const body = group.inline ? lines.join(" · ") : lines.join("\n");
  return group.label ? `-# ${group.label}\n${body}` : body;
}

/** Keep whole groups while they fit; the rest collapses into one "and N more" note. */
function fittedGroups(groups: AuditGroup[], used: number): string[] {
  const texts = groups.map(groupText).filter(Boolean);
  const kept: string[] = [];
  let budget = TEXT_BUDGET - used;
  for (const [index, text] of texts.entries()) {
    if (text.length > budget) {
      const left = texts.length - index;
      kept.push(`*And **${left}** more ${left === 1 ? "section" : "sections"} not shown.*`);
      break;
    }
    kept.push(text);
    budget -= text.length;
  }
  return kept;
}

export function auditCard(payload: AuditPayload, now = new Date()): ContainerBuilder {
  const module = auditModules[payload.module];
  const unix = Math.floor(now.getTime() / 1000);
  const heading = `### ${module.emoji} ${clip(payload.title, 200)}\n${clip(payload.summary, 1000)}`;
  // <t:…> renders in the reader's local time, so the UTC stamp is plain text; the relative one stays live.
  const utc = `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 16)} UTC`;
  const footer = `-# By ${formatUserFromUser(payload.actor)} · ${utc} · <t:${unix}:R>`;

  const card = new ContainerBuilder().setAccentColor(actionColors[payload.action]);
  const avatar = payload.actor.displayAvatarURL({ size: 128 });
  if (avatar) {
    card.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(heading))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );
  } else {
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(heading));
  }

  const groups = fittedGroups(payload.groups ?? [], heading.length + footer.length);
  if (groups.length > 0) {
    card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    for (const text of groups) {
      card.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    }
  }
  card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  card.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  return card;
}

type LogChannel = TextChannel | NewsChannel;

async function resolveLogChannel(guild: Guild, channelId: string): Promise<LogChannel | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return null;
  }
  return channel;
}

const WEBHOOK_NAME = "Apex Horizon Logs";

// One bot-owned webhook per channel; every send sets its own visible name, so the module count
// never runs into Discord's 15-webhooks-per-channel limit. Lookups cost an API call: cache them.
const webhooks = new Map<string, Webhook>();

async function auditWebhook(channel: LogChannel): Promise<Webhook> {
  const cached = webhooks.get(channel.id);
  if (cached) {
    return cached;
  }
  const botId = channel.client.user?.id;
  const owned = (await channel.fetchWebhooks()).filter((webhook) => webhook.owner?.id === botId && webhook.token);
  const webhook =
    owned.find((entry) => entry.name === WEBHOOK_NAME) ??
    owned.first() ??
    (await channel.createWebhook({
      name: WEBHOOK_NAME,
      avatar: channel.client.user?.displayAvatarURL({ size: 256 }),
      reason: "Audit log identity",
    }));
  webhooks.set(channel.id, webhook);
  return webhook;
}

async function sendViaWebhook(channel: LogChannel, payload: AuditPayload, card: ContainerBuilder): Promise<void> {
  const webhook = await auditWebhook(channel);
  try {
    await webhook.send({
      username: auditModules[payload.module].name,
      avatarURL: channel.client.user?.displayAvatarURL({ size: 256 }),
      components: [card],
      flags: MessageFlags.IsComponentsV2,
      withComponents: true,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    webhooks.delete(channel.id);
    throw error;
  }
}

/** Returns false when the log could not be written anywhere. */
export async function publishAudit(payload: AuditPayload): Promise<boolean> {
  const channel = await resolveLogChannel(payload.guild, payload.channelId).catch(() => null);
  if (!channel) {
    return false;
  }
  // Before sending: the mention resolver must never turn a log into a mention.
  silenceChannel(channel.id);

  const card = auditCard(payload);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendViaWebhook(channel, payload, card);
      return true;
    } catch (error) {
      if (attempt === 1) {
        console.error(`Audit webhook failed in ${channel.id}; sending as the bot`, error);
      }
    }
  }

  return channel
    .send({ components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } })
    .then(() => true)
    .catch((error) => {
      console.error(`Audit log could not be written in ${channel.id}`, error);
      return false;
    });
}

/** Up to 15 mentions, then "And N more". Shared by logs that list tickets or members. */
export function listWithOverflow(items: string[], max = 15): string[] {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  if (extra > 0) {
    shown.push(`*And **${extra}** more.*`);
  }
  return shown;
}

/** `**Label** value` — the one line shape every log uses for a fact. */
export function fact(label: string, value: string): string {
  return `**${label}** ${value}`;
}
