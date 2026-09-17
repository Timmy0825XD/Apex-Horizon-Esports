import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type NewsChannel,
  type TextChannel,
  type User,
} from "discord.js";
import { embedColors } from "./embeds.js";
import { formatUserFromUser } from "./formatters.js";

export const auditLogTitles = {
  botLogs: "Bot Logs",
} as const;

type AuditPayload = {
  guild: Guild;
  channelId: string;
  title: string;
  description: string;
  details: string[];
  actor: User;
};

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
  if (payload.details.length > 0) {
    embed.addFields({ name: "Details", value: payload.details.join("\n") });
  }
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

async function sendViaWebhook(channel: LogChannel, title: string, embed: EmbedBuilder): Promise<boolean> {
  const existing = (await channel.fetchWebhooks()).find(
    (webhook) => webhook.name === title && webhook.owner?.id === channel.client.user?.id,
  );
  const webhook =
    existing ??
    (await channel.createWebhook({
      name: title,
      reason: `Audit log identity: ${title}`,
    }));

  await webhook.send({
    username: title,
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
  return true;
}

export async function publishAudit(payload: AuditPayload): Promise<void> {
  const channel = await resolveLogChannel(payload.guild, payload.channelId).catch(() => null);
  if (!channel) {
    return;
  }

  const embed = auditEmbed(payload);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendViaWebhook(channel, payload.title, embed);
      return;
    } catch {
      // retry once, then fall back to the bot account
    }
  }

  await channel
    .send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    })
    .catch(() => undefined);
}
