import type { GuildSettings, StaffConfig } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
import { isJudge, isRecorder, isStaff } from "../schedule/access.js";
import type { StaffInput } from "../staff/fields.js";

export function canMarkAttendance(
  interaction: ChatInputCommandInteraction,
  settings: GuildSettings | null,
  staff: StaffInput | null,
): boolean {
  if (isGuildAdmin(interaction, settings) || isOrganiser(interaction, staff as StaffConfig | null)) {
    return true;
  }
  return staff != null && (isJudge(interaction, staff) || isRecorder(interaction, staff));
}

export function canUseAttendanceTools(
  interaction: ChatInputCommandInteraction,
  settings: GuildSettings | null,
  staff: StaffInput | null,
): boolean {
  if (isGuildAdmin(interaction, settings) || isOrganiser(interaction, staff as StaffConfig | null)) {
    return true;
  }
  return staff != null && (isStaff(interaction, staff) || isJudge(interaction, staff) || isRecorder(interaction, staff));
}

export function canViewOtherSalary(
  interaction: ChatInputCommandInteraction,
  settings: GuildSettings | null,
  staff: StaffInput | null,
): boolean {
  return isGuildAdmin(interaction, settings) || isOrganiser(interaction, staff as StaffConfig | null);
}

export function canExportSheet(
  interaction: ChatInputCommandInteraction,
  staff: StaffInput | null,
): boolean {
  return isOrganiser(interaction, staff as StaffConfig | null);
}
