import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatRole, formatUser } from "../../lib/formatters.js";
import { staffFields, type StaffInput } from "./fields.js";

function fieldDetail(guild: Guild, staff: StaffInput, key: keyof StaffInput): string {
  const field = staffFields.find((entry) => entry.key === key);
  if (!field) {
    return `\`${key}\``;
  }
  const value = staff[key];
  if (!value) {
    return `**${field.label}:** *Not configured*`;
  }
  const mention = field.key.endsWith("RoleId") ? formatRole(guild, value) : formatChannel(guild, value);
  return `**${field.label}:** ${mention}`;
}

export async function auditStaffConfigMutation(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  action: "set" | "edit",
  staff: StaffInput,
  changedKeys: Array<keyof StaffInput>,
): Promise<void> {
  const details =
    action === "set"
      ? staffFields.map((field) => fieldDetail(guild, staff, field.key))
      : changedKeys.map((key) => fieldDetail(guild, staff, key));

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description:
      action === "set"
        ? "Staff hierarchy and coordination channels were configured for the first time."
        : "Staff hierarchy or coordination channels were edited.",
    details,
    actor: interaction.user,
  });
}

export async function auditStaffMembership(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  action: "recruit" | "fire",
  targetId: string,
  post: string,
  roleIds: string[],
): Promise<void> {
  const roleLines = roleIds.length > 0 ? roleIds.map((roleId) => formatRole(guild, roleId)) : ["*None*"];

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description:
      action === "recruit"
        ? "A member was recruited to a staff post."
        : "A staff post was removed from a member.",
    details: [`**Member:** ${formatUser(targetId)}`, `**Post:** ${post}`, `**Roles:** ${roleLines.join(", ")}`],
    actor: interaction.user,
  });
}
