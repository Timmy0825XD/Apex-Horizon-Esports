import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { publishAudit } from "../../lib/audit.js";
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
    module: "moderation",
    action: added ? "created" : "deleted",
    title: added ? "Role granted" : "Role removed",
    summary: added
      ? `${formatUser(targetId)} received ${formatRole(guild, roleId)}.`
      : `${formatUser(targetId)} lost ${formatRole(guild, roleId)}.`,
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
    module: "moderation",
    action: action === "add" ? "created" : "deleted",
    title: action === "add" ? "Role granted in bulk" : "Role removed in bulk",
    summary:
      action === "add"
        ? `${formatRole(guild, roleId)} was given to \`${changed}\` ${changed === 1 ? "member" : "members"}.`
        : `${formatRole(guild, roleId)} was taken from \`${changed}\` ${changed === 1 ? "member" : "members"}.`,
    actor: interaction.user,
  }).catch(() => undefined);
}
