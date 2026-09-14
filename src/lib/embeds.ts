import { EmbedBuilder } from "discord.js";
import { emojis } from "../emojis.js";

export const embedColors = {
  info: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245,
} as const;

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(embedColors.info).setTitle(`${emojis.info} ${title}`);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(embedColors.error).setTitle(`${emojis.error} ${title}`);
  if (description) {
    embed.setDescription(description);
  }
  return embed;
}
