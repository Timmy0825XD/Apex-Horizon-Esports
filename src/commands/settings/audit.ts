import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatRole } from "../../lib/formatters.js";
import { settingFields, type SettingsInput } from "./fields.js";

function fieldDetail(guild: Guild, settings: SettingsInput, key: keyof SettingsInput): string {
  const field = settingFields.find((entry) => entry.key === key);
  if (!field) {
    return `\`${key}\``;
  }
  const mention = field.key.endsWith("RoleId")
    ? formatRole(guild, settings[key])
    : formatChannel(guild, settings[key]);
  return `**${field.label}:** ${mention}`;
}

export async function auditSettingsMutation(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  action: "set" | "edit",
  settings: GuildSettings,
  changedKeys: Array<keyof SettingsInput>,
): Promise<void> {
  const details =
    action === "set"
      ? settingFields.map((field) => fieldDetail(guild, settings, field.key))
      : changedKeys.map((key) => fieldDetail(guild, settings, key));

  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description:
      action === "set"
        ? "Server settings were configured for the first time."
        : "Server settings were edited.",
    details,
    actor: interaction.user,
  });
}
