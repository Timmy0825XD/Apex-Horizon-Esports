import { SlashCommandBuilder } from "discord.js";

export const roomSlash = new SlashCommandBuilder()
  .setName("room")
  .setDescription("Open battle tickets or inspect the queue")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Create every pending battle ticket for a tournament now")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament whose waiting tickets to open")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("available")
      .setDescription("Show matches that still need a battle ticket")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament to inspect")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );
