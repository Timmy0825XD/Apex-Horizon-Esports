import { SlashCommandBuilder } from "discord.js";

export const panelSlash = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("Post informative panels for the staff")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName("tutorial").setDescription("Pick commands and post a staff guide for each one"),
  );
