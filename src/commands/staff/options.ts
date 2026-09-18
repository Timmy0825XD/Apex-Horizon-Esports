import type { ChatInputCommandInteraction } from "discord.js";
import { channelFields, roleFields, type StaffInput } from "./fields.js";

export function readRequiredStaff(interaction: ChatInputCommandInteraction): StaffInput {
  return {
    managerRoleId: interaction.options.getRole("manager_role", true).id,
    t1AdminRoleId: interaction.options.getRole("t1_admin_role")?.id ?? null,
    t2AdminRoleId: interaction.options.getRole("t2_admin_role")?.id ?? null,
    challongeModRoleId: interaction.options.getRole("challonge_mod", true).id,
    serverHelperRoleId: interaction.options.getRole("server_helper_role", true).id,
    bestStaffRoleId: interaction.options.getRole("best_staff_role", true).id,
    judgeRoleId: interaction.options.getRole("judge_role", true).id,
    recorderRoleId: interaction.options.getRole("recorder_role", true).id,
    staffRoleId: interaction.options.getRole("staff_role", true).id,
    staffchatChannelId: interaction.options.getChannel("staffchat_channel", true).id,
    staffAnnouncementChannelId: interaction.options.getChannel("staff_announcement_channel", true).id,
    staffRulesChannelId: interaction.options.getChannel("staff_rules_channel", true).id,
    staffDetailsChannelId: interaction.options.getChannel("staff_details_channel", true).id,
  };
}

export function readStaffPatch(interaction: ChatInputCommandInteraction): Partial<StaffInput> {
  const patch: Partial<StaffInput> = {};

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

export function mergeStaff(current: StaffInput, patch: Partial<StaffInput>): StaffInput {
  return { ...current, ...patch };
}

export function changedStaffKeys(current: StaffInput, next: StaffInput): Array<keyof StaffInput> {
  return (Object.keys(current) as Array<keyof StaffInput>).filter((key) => current[key] !== next[key]);
}
