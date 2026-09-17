import type { ChatInputCommandInteraction } from "discord.js";
import { channelFields, roleFields, type SettingsInput } from "./fields.js";

export function readRequiredSettings(interaction: ChatInputCommandInteraction): SettingsInput {
  return {
    adminRoleId: interaction.options.getRole("admin_role", true).id,
    verifiedRoleId: interaction.options.getRole("verified_role", true).id,
    bracketAdminRoleId: interaction.options.getRole("bracket_admin", true).id,
    schedulesChannelId: interaction.options.getChannel("schedules_channel", true).id,
    thumbnailChannelId: interaction.options.getChannel("thumbnail_channel", true).id,
    bansChannelId: interaction.options.getChannel("bans_channel", true).id,
    challongeLogsChannelId: interaction.options.getChannel("challonge_logs", true).id,
    botLogsChannelId: interaction.options.getChannel("bot_logs", true).id,
  };
}

export function readSettingsPatch(interaction: ChatInputCommandInteraction): Partial<SettingsInput> {
  const patch: Partial<SettingsInput> = {};

  for (const field of roleFields) {
    const role = interaction.options.getRole(field.option);
    if (role) {
      patch[field.key] = role.id;
    }
  }

  for (const field of channelFields) {
    const channel = interaction.options.getChannel(field.option);
    if (channel) {
      patch[field.key] = channel.id;
    }
  }

  return patch;
}

export function mergeSettings(current: SettingsInput, patch: Partial<SettingsInput>): SettingsInput {
  return { ...current, ...patch };
}

export function changedSettingKeys(current: SettingsInput, next: SettingsInput): Array<keyof SettingsInput> {
  return (Object.keys(current) as Array<keyof SettingsInput>).filter((key) => current[key] !== next[key]);
}
