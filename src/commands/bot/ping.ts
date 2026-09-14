import { ContainerBuilder } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { prisma } from "../../lib/prisma.js";
import { formatDuration, memoryLine, reach } from "../../lib/runtime.js";
import { botAvatarUrl, divider, headingWithThumbnail, textBlock, type BotViewContext } from "./view.js";

async function measureDatabasePing(): Promise<{ ok: true; ms: number } | { ok: false; message: string }> {
  const started = Date.now();
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return { ok: false, message };
  }
}

function formatMs(ms: number): string {
  return `\`${ms}ms\``;
}

export async function buildPingContainer(ctx: BotViewContext): Promise<ContainerBuilder> {
  const botLatency = Math.max(0, Date.now() - ctx.createdTimestamp);
  const database = await measureDatabasePing();
  const { servers, members } = reach(ctx.client);
  const avatar = botAvatarUrl(ctx.client);
  const container = new ContainerBuilder();

  if (avatar) {
    container.addSectionComponents(headingWithThumbnail(`# ${emojis.ping} Pong!`, avatar));
  } else {
    container.addTextDisplayComponents(textBlock(`# ${emojis.ping} Pong!`));
  }

  if (!database.ok) {
    return container.setAccentColor(embedColors.error).addTextDisplayComponents(
      textBlock("The database did not respond."),
      textBlock(
        [
          `${emojis.ping} **Discord:** ${formatMs(ctx.client.ws.ping)}`,
          `${emojis.info} **Bot:** ${formatMs(botLatency)}`,
          `${emojis.mongo} **Database:** *${database.message}*`,
        ].join("\n"),
      ),
    );
  }

  return container
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(
        [
          `${emojis.ping} **Discord:** ${formatMs(ctx.client.ws.ping)}`,
          `${emojis.mongo} **Database:** ${formatMs(database.ms)}`,
          `${emojis.info} **Bot:** ${formatMs(botLatency)}`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `## ${emojis.runtime} Runtime`,
          `${emojis.memory} **RAM:** \`${memoryLine()}\``,
          `${emojis.uptime} **Uptime:** \`${formatDuration(process.uptime())}\``,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `## ${emojis.size} Reach`,
          `${emojis.server} **Servers:** \`${servers}\``,
          `${emojis.members} **Members:** \`${members}\``,
        ].join("\n"),
      ),
    );
}
