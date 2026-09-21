import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatRole, formatUser } from "../../lib/formatters.js";
import { loadGuildSettings } from "../settings/store.js";

export async function auditRoleToggle(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  roleId: string,
  targetId: string,
  added: boolean,
): Promise<void> {
  const settings = await loadGuildSettings(guild.id).catch(() => null);
  if (!settings) {
    return;
  }

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: added ? "A Discord role was granted to a member." : "A Discord role was removed from a member.",
    details: [`**Member:** ${formatUser(targetId)}`, `**Role:** ${formatRole(guild, roleId)}`],
    actor: interaction.user,
  }).catch(() => undefined);
}

export async function auditRoleMass(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  roleId: string,
  action: "add" | "remove",
  changed: number,
): Promise<void> {
  if (changed <= 0) {
    return;
  }

  const settings = await loadGuildSettings(guild.id).catch(() => null);
  if (!settings) {
    return;
  }

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description:
      action === "add" ? "A Discord role was granted in bulk." : "A Discord role was removed in bulk.",
    details: [
      `**Role:** ${formatRole(guild, roleId)}`,
      action === "add" ? `**Members granted:** \`${changed}\`` : `**Members removed:** \`${changed}\``,
    ],
    actor: interaction.user,
  }).catch(() => undefined);
}
