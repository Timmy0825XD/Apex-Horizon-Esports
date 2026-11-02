import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { fact, publishAudit } from "../../lib/audit.js";
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
  return fact(field.label, mention);
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
    module: "serverConfig",
    action: action === "set" ? "created" : "updated",
    title: action === "set" ? "Server settings configured" : "Server settings edited",
    summary:
      action === "set"
        ? "The bot's roles and channels for this server were set for the first time."
        : `**${details.length}** server ${details.length === 1 ? "setting was" : "settings were"} changed.`,
    groups: [{ label: action === "set" ? "Settings" : "New values", lines: details }],
    actor: interaction.user,
  });
}
