import { SlashCommandBuilder } from "discord.js";

export const roomSlash = new SlashCommandBuilder()
  .setName("room")
  .setDescription("Open battle tickets or inspect the queue")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Create pending battle tickets for a tournament now")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament whose waiting tickets to open")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("group")
          .setDescription("Only matches in this group")
          .setRequired(false)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("round")
          .setDescription("Only matches in this round")
          .setRequired(false)
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
