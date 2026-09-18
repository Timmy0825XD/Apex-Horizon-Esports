import { SlashCommandBuilder } from "discord.js";

export const teamSlash = new SlashCommandBuilder()
  .setName("team")
  .setDescription("Look up tournament participants")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("Get information about a specific team/player")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament to search").setRequired(true).setAutocomplete(true),
      )
      .addUserOption((option) => option.setName("user").setDescription("The Discord user to look up"))
      .addStringOption((option) =>
        option.setName("alias").setDescription("Game ID, in-game name, or Discord ID").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("Publish every team in this tournament")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament whose teams to publish")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );
