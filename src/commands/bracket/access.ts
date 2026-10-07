import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import type { StaffConfig } from "@prisma/client";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { hasRole, isTournamentAdminOrHelper } from "../schedule/access.js";
import type { TournamentRecord } from "../tournament/fields.js";

type RoleInteraction = ChatInputCommandInteraction | ButtonInteraction;

export async function canUploadScore(
  interaction: RoleInteraction,
  tournament: TournamentRecord,
  staff: StaffConfig | null,
): Promise<boolean> {
  if (await memberIsOrganiser(interaction)) {
    return true;
  }
  if (isTournamentAdminOrHelper(interaction, tournament)) {
    return true;
  }
  if (!staff) {
    return false;
  }
  return (
    hasRole(interaction, staff.staffRoleId) ||
    hasRole(interaction, staff.judgeRoleId) ||
    hasRole(interaction, staff.recorderRoleId)
  );
}

export async function canCorrectBracket(interaction: RoleInteraction): Promise<boolean> {
  return memberIsOrganiser(interaction);
}
