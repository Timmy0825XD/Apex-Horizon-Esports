import type { Guild, User } from "discord.js";
import { fact, publishAudit } from "../../lib/audit.js";
import { formatUser } from "../../lib/formatters.js";
import { loadGuildSettings } from "../settings/store.js";
import type { BanDuration } from "./durations.js";

export async function auditUserBan(
  interaction: { user: User },
  guild: Guild,
  userId: string,
  duration: BanDuration,
  expiresAt: Date | null,
  reason: string | null,
  sourceLink?: string,
): Promise<void> {
  const settings = await loadGuildSettings(guild.id).catch(() => null);
  if (!settings) {
    return;
  }

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "moderation",
    action: "deleted",
    title: "User banned",
    summary: `${formatUser(userId)} was banned for **${duration}**.`,
    groups: [
      {
        lines: [
          fact("Expires", expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F> (<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)` : "*Never*"),
          fact("Reason", reason ?? "*No reason provided*"),
          ...(sourceLink ? [fact("From", `ban announcement · ${sourceLink}`)] : []),
        ],
      },
    ],
    actor: interaction.user,
  }).catch(() => undefined);
}

export async function auditUserUnban(
  interaction: { user: User },
  guild: Guild,
  userId: string,
  sourceLink?: string,
): Promise<void> {
  const settings = await loadGuildSettings(guild.id).catch(() => null);
  if (!settings) {
    return;
  }

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "moderation",
    action: "updated",
    title: "User unbanned",
    summary: `${formatUser(userId)} can join the server again.`,
    ...(sourceLink ? { groups: [{ lines: [fact("From", `unban announcement · ${sourceLink}`)] }] } : {}),
    actor: interaction.user,
  }).catch(() => undefined);
}
