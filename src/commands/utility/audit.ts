import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { prisma } from "../../lib/prisma.js";

export async function auditUtility(
  actor: ChatInputCommandInteraction | { user: User },
  guild: Guild,
  description: string,
  details: string[],
): Promise<void> {
  const row = await prisma.guild
    .findUnique({
      where: { guildId: guild.id },
      select: { settings: true },
    })
    .catch(() => null);
  const channelId = row?.settings?.botLogsChannelId;
  if (!channelId) {
    return;
  }

  await publishAudit({
    guild,
    channelId,
    title: auditLogTitles.botLogs,
    description,
    details,
    actor: actor.user,
  }).catch(() => undefined);
}
