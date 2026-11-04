import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ContainerBuilder, type Guild } from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

async function hydrateMembers(guild: Guild): Promise<void> {
  if (guild.members.cache.size >= guild.memberCount) {
    return;
  }

  try {
    await guild.members.fetch();
  } catch {
    // Total still uses memberCount; Human/Bot fall back to whatever is cached.
  }
}

function channelCounts(guild: Guild): { text: number; voice: number; categories: number } {
  let text = 0;
  let voice = 0;
  let categories = 0;

  for (const channel of guild.channels.cache.values()) {
    switch (channel.type) {
      case ChannelType.GuildCategory:
        categories += 1;
        break;
      case ChannelType.GuildVoice:
      case ChannelType.GuildStageVoice:
        voice += 1;
        break;
      case ChannelType.GuildText:
      case ChannelType.GuildAnnouncement:
      case ChannelType.GuildForum:
      case ChannelType.GuildMedia:
        text += 1;
        break;
      default:
        break;
    }
  }

  return { text, voice, categories };
}

function memberCounts(guild: Guild): { total: number; humans: number; bots: number } {
  const total = guild.memberCount;
  const bots = guild.members.cache.filter((member) => member.user.bot).size;
  return { total, humans: Math.max(0, total - bots), bots };
}

export async function buildServerInfoContainer(
  guild: Guild,
  requesterId: string,
  requestedAt: Date,
): Promise<ContainerBuilder> {
  await hydrateMembers(guild);

  const icon = guild.iconURL({ size: 256 });
  const iconLink = guild.iconURL({ size: 1024 });
  const created = unixSeconds(guild.createdAt);
  const requested = unixSeconds(requestedAt);
  const { text, voice, categories } = channelCounts(guild);
  const { total, humans, bots } = memberCounts(guild);
  const title = `## ${escapeDiscord(guild.name)}\n-# ID ${guild.id}`;
  const identity = [
    `${emojis.owner} **Owner** ${formatUser(guild.ownerId)}`,
    `${emojis.creation} **Created** <t:${created}:D> · <t:${created}:R>`,
  ].join("\n");
  const container = new ContainerBuilder().setAccentColor(embedColors.success);

  if (icon) {
    container.addSectionComponents(headingWithThumbnail(title, icon, identity));
  } else {
    container.addTextDisplayComponents(textBlock(title), textBlock(identity));
  }

  const boosts = guild.premiumSubscriptionCount ?? 0;
  const counts = [
    `${emojis.members} **Members** \`${total}\` · ${emojis.humans} \`${humans}\` humans · ${emojis.bots} \`${bots}\` bots`,
    `${emojis.textChannel} **Text** \`${text}\` · ${emojis.voice} **Voice** \`${voice}\` · ${emojis.categories} **Categories** \`${categories}\``,
    `${emojis.gem} **Roles** \`${guild.roles.cache.size}\` · ${emojis.party} **Boosts** \`${boosts}\` · Level ${guild.premiumTier}`,
  ];

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(counts.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(requesterId)} · <t:${requested}:F>`));
  if (iconLink) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(iconLink)
          .setLabel("Server icon")
          .setEmoji(customEmoji(emojis.link)),
      ),
    );
  }
  return container;
}
