import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type NewsChannel,
  type TextChannel,
  type User,
  type Webhook,
} from "discord.js";
import { embedColors } from "./embeds.js";
import { formatUserFromUser } from "./formatters.js";

export const auditLogTitles = {
  botLogs: "Bot Logs",
  challongeLogs: "Challonge Logs",
  scoreUpload: "Score Upload",
  ticketSystem: "Ticket System",
} as const;

type AuditPayload = {
  guild: Guild;
  channelId: string;
  title: string;
  description: string;
  details: string[];
  actor: User;
};

function chunkLines(lines: string[], max = 1024): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const piece = line.length > max ? `${line.slice(0, max - 1)}…` : line;
    const next = current ? `${current}\n${piece}` : piece;
    if (next.length > max) {
      if (current) {
        chunks.push(current);
      }
      current = piece;
    } else {
      current = next;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

function auditEmbed(payload: AuditPayload): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(embedColors.info)
    .setTitle(payload.title)
    .setDescription(payload.description)
    .addFields(
      { name: "Triggered By", value: formatUserFromUser(payload.actor), inline: true },
      { name: "When", value: `<t:${Math.floor(Date.now() / 1000)}:F> (\`UTC\`)`, inline: true },
    )
    .setTimestamp(new Date());

  const avatar = payload.actor.displayAvatarURL({ size: 128 });
  if (avatar) {
    embed.setThumbnail(avatar);
  }
  const chunks = chunkLines(payload.details);
  chunks.forEach((chunk, index) => {
    embed.addFields({ name: index === 0 ? "Details" : `Details (${index + 1})`, value: chunk });
  });
  return embed;
}

type LogChannel = TextChannel | NewsChannel;

async function resolveLogChannel(guild: Guild, channelId: string): Promise<LogChannel | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (
    !channel ||
    (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
  ) {
    return null;
  }
  return channel;
}

// Webhook lookups cost an API call; keep the one we found per channel and title.
const webhooks = new Map<string, Webhook>();

async function auditWebhook(channel: LogChannel, title: string): Promise<Webhook> {
  const key = `${channel.id}:${title}`;
  const cached = webhooks.get(key);
  if (cached) {
    return cached;
  }
  const bot = channel.client.user;
  const existing = (await channel.fetchWebhooks()).find(
    (webhook) => webhook.name === title && webhook.owner?.id === bot?.id,
  );
  const webhook =
    existing ??
    (await channel.createWebhook({
      name: title,
      avatar: bot?.displayAvatarURL({ size: 256 }),
      reason: `Audit log identity: ${title}`,
    }));
  webhooks.set(key, webhook);
  return webhook;
}

async function sendViaWebhook(channel: LogChannel, title: string, embed: EmbedBuilder): Promise<void> {
  const webhook = await auditWebhook(channel, title);
  try {
    await webhook.send({
      username: title,
      avatarURL: channel.client.user?.displayAvatarURL({ size: 256 }),
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    webhooks.delete(`${channel.id}:${title}`);
    throw error;
  }
}

/** Returns false when the log could not be written anywhere. */
export async function publishAudit(payload: AuditPayload): Promise<boolean> {
  const channel = await resolveLogChannel(payload.guild, payload.channelId).catch(() => null);
  if (!channel) {
    return false;
  }

  const embed = auditEmbed(payload);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendViaWebhook(channel, payload.title, embed);
      return true;
    } catch {
      // retry once, then fall back to the bot account
    }
  }

  return channel
    .send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    })
    .then(() => true)
    .catch(() => false);
}
