import {
  ChannelType,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";
import { fireChoices, recruitChoices } from "./packages.js";

const textChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

function addRoleOption(
  subcommand: SlashCommandSubcommandBuilder,
  name: string,
  description: string,
  required: boolean,
) {
  return subcommand.addRoleOption((option) =>
    option.setName(name).setDescription(description).setRequired(required),
  );
}

function addChannelOption(
  subcommand: SlashCommandSubcommandBuilder,
  name: string,
  description: string,
  required: boolean,
) {
  return subcommand.addChannelOption((option) =>
    option
      .setName(name)
      .setDescription(description)
      .addChannelTypes(...textChannels)
      .setRequired(required),
  );
}

function addSetOptions(subcommand: SlashCommandSubcommandBuilder) {
  addRoleOption(subcommand, "manager_role", "Organiser / manager role", true);
  addRoleOption(subcommand, "challonge_mod", "Bracket moderator role", true);
  addRoleOption(subcommand, "server_helper_role", "Server helper role", true);
  addRoleOption(subcommand, "best_staff_role", "Best staff recognition role", true);
  addRoleOption(subcommand, "judge_role", "Judge role", true);
  addRoleOption(subcommand, "recorder_role", "Recorder role", true);
  addRoleOption(subcommand, "staff_role", "General staff role", true);
  addChannelOption(subcommand, "staffchat_channel", "Channel for recruit welcome messages", true);
  addChannelOption(subcommand, "staff_announcement_channel", "Linked from the recruit welcome", true);
  addChannelOption(subcommand, "staff_rules_channel", "Linked from the recruit welcome", true);
  addChannelOption(subcommand, "staff_details_channel", "Linked from the recruit welcome", true);
  addRoleOption(subcommand, "t1_admin_role", "Admin tier 1 role", false);
  addRoleOption(subcommand, "t2_admin_role", "Admin tier 2 role", false);
  return subcommand;
}

function addEditOptions(subcommand: SlashCommandSubcommandBuilder) {
  addRoleOption(subcommand, "manager_role", "Organiser / manager role", false);
  addRoleOption(subcommand, "t1_admin_role", "Admin tier 1 role", false);
  addRoleOption(subcommand, "t2_admin_role", "Admin tier 2 role", false);
  addRoleOption(subcommand, "challonge_mod", "Bracket moderator role", false);
  addRoleOption(subcommand, "server_helper_role", "Server helper role", false);
  addRoleOption(subcommand, "best_staff_role", "Best staff recognition role", false);
  addRoleOption(subcommand, "judge_role", "Judge role", false);
  addRoleOption(subcommand, "recorder_role", "Recorder role", false);
  addRoleOption(subcommand, "staff_role", "General staff role", false);
  addChannelOption(subcommand, "staffchat_channel", "Channel for recruit welcome messages", false);
  addChannelOption(subcommand, "staff_announcement_channel", "Linked from the recruit welcome", false);
  addChannelOption(subcommand, "staff_rules_channel", "Linked from the recruit welcome", false);
  addChannelOption(subcommand, "staff_details_channel", "Linked from the recruit welcome", false);
  return subcommand;
}

export const staffSlash = new SlashCommandBuilder()
  .setName("staff")
  .setDescription("Staff hierarchy, recruiting, and payroll")
  .setDMPermission(false)
  .addSubcommandGroup((group) =>
    group
      .setName("config")
      .setDescription("Staff roles and coordination channels")
      .addSubcommand((subcommand) =>
        addSetOptions(subcommand.setName("set").setDescription("First-time staff roles and coordination channels")),
      )
      .addSubcommand((subcommand) =>
        addEditOptions(subcommand.setName("edit").setDescription("Change a configured staff role or channel")),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("view").setDescription("Read the configured staff roles and channels"),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("recruit")
      .setDescription("Grant a staff role package and welcome the member")
      .addUserOption((option) =>
        option.setName("user").setDescription("Member to recruit").setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("role")
          .setDescription("The specific role to grant")
          .setRequired(true)
          .addChoices(...recruitChoices),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("fire")
      .setDescription("Remove a staff post or every configured staff role")
      .addUserOption((option) =>
        option.setName("user").setDescription("Member to fire").setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("role")
          .setDescription("The specific role to remove")
          .setRequired(true)
          .addChoices(...fireChoices),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("work")
      .setDescription("Tournament payroll board from attendance")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament to summarise")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addBooleanOption((option) =>
        option
          .setName("include_default_wins")
          .setDescription("Include default-win attendance (default: false)")
          .setRequired(false),
      ),
  );
