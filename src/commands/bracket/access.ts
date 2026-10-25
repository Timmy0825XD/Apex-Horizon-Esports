import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { isTournamentAdminOrHelper } from "../schedule/access.js";
import type { TournamentRecord } from "../tournament/fields.js";

type RoleInteraction = ChatInputCommandInteraction | ButtonInteraction;

export async function canUploadScore(interaction: RoleInteraction, tournament: TournamentRecord): Promise<boolean> {
  if (await memberIsOrganiser(interaction)) {
    return true;
  }
  return isTournamentAdminOrHelper(interaction, tournament);
}

export async function canCorrectBracket(interaction: RoleInteraction): Promise<boolean> {
  return memberIsOrganiser(interaction);
}
