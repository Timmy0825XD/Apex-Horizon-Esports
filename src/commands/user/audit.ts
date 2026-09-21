import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatUser } from "../../lib/formatters.js";
import { loadGuildSettings } from "../settings/store.js";
import type { BanDuration } from "./durations.js";

export async function auditUserBan(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  userId: string,
  duration: BanDuration,
  expiresAt: Date | null,
  reason: string | null,
): Promise<void> {
  const settings = await loadGuildSettings(guild.id).catch(() => null);
  if (!settings) {
    return;
  }

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: "A Discord user was banned.",
    details: [
      `**User:** ${formatUser(userId)}`,
      `**Duration:** **${duration}**`,
      `**Expires:** ${expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : "*Never*"}`,
      `**Reason:** ${reason ?? "*No reason provided*"}`,
    ],
    actor: interaction.user,
  }).catch(() => undefined);
}

export async function auditUserUnban(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  userId: string,
): Promise<void> {
  const settings = await loadGuildSettings(guild.id).catch(() => null);
  if (!settings) {
    return;
  }

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: "A Discord user was unbanned.",
    details: [`**User:** ${formatUser(userId)}`],
    actor: interaction.user,
  }).catch(() => undefined);
}
