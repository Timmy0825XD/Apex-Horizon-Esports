import { SlashCommandBuilder } from "discord.js";

export const roleSlash = new SlashCommandBuilder()
  .setName("role")
  .setDescription("Toggle, bulk-assign, or list Discord roles")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("user")
      .setDescription("Toggle one role on one member")
      .addUserOption((option) =>
        option.setName("target").setDescription("Member to update").setRequired(true),
      )
      .addRoleOption((option) =>
        option.setName("role").setDescription("Role to add or remove").setRequired(true),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("add")
      .setDescription("Add a role in bulk")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("all")
          .setDescription("Add a role to every eligible member")
          .addRoleOption((option) =>
            option.setName("role").setDescription("Role to grant").setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("remove")
      .setDescription("Remove a role in bulk")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("all")
          .setDescription("Remove a role from every member who has it")
          .addRoleOption((option) =>
            option.setName("role").setDescription("Role to remove").setRequired(true),
          ),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List or export members of a role")
      .addRoleOption((option) =>
        option.setName("role").setDescription("Role to list").setRequired(true),
      ),
  );
