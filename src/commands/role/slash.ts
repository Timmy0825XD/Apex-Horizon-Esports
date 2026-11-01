import { SlashCommandBuilder } from "discord.js";

export const roleSlash = new SlashCommandBuilder()
  .setName("role")
  .setDescription("Give, remove, or list roles")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("user")
      .setDescription("Give or remove a role from a member")
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
          .setDescription("Give a role to every eligible member")
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
          .setDescription("Remove a role from everyone who has it")
          .addRoleOption((option) =>
            option.setName("role").setDescription("Role to remove").setRequired(true),
          ),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List or export a role's members")
      .addRoleOption((option) =>
        option.setName("role").setDescription("Role to list").setRequired(true),
      ),
  );
