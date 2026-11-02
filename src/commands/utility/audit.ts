import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { publishAudit, type AuditAction, type AuditGroup } from "../../lib/audit.js";
import { prisma } from "../../lib/prisma.js";

export async function auditUtility(
  actor: ChatInputCommandInteraction | { user: User },
  guild: Guild,
  log: { action: AuditAction; title: string; summary: string; groups?: AuditGroup[] },
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
    module: "utility",
    ...log,
    actor: actor.user,
  }).catch(() => undefined);
}
