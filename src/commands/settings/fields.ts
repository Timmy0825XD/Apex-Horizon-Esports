import type { GuildSettings } from "@prisma/client";

export const roleFields = [
  { key: "adminRoleId", option: "admin_role", label: "Admin Role" },
  { key: "verifiedRoleId", option: "verified_role", label: "Verified Role" },
  { key: "bracketAdminRoleId", option: "bracket_admin", label: "Bracket Admin" },
] as const;

export const channelFields = [
  { key: "schedulesChannelId", option: "schedules_channel", label: "Schedules Channel" },
  { key: "thumbnailChannelId", option: "thumbnail_channel", label: "Thumbnail Channel" },
  { key: "bansChannelId", option: "bans_channel", label: "Bans Channel" },
  { key: "challongeLogsChannelId", option: "challonge_logs", label: "Challonge Logs" },
  { key: "botLogsChannelId", option: "bot_logs", label: "Bot Logs" },
] as const;

export const settingFields = [...roleFields, ...channelFields] as const;

export type RoleFieldKey = (typeof roleFields)[number]["key"];
export type ChannelFieldKey = (typeof channelFields)[number]["key"];
export type SettingFieldKey = (typeof settingFields)[number]["key"];

export type SettingsInput = Pick<GuildSettings, SettingFieldKey>;
