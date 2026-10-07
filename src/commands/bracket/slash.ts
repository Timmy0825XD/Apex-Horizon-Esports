import { SlashCommandBuilder } from "discord.js";

export const bracketSlash = new SlashCommandBuilder()
  .setName("bracket")
  .setDescription("Report or correct official bracket scores")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("upload")
      .setDescription("Report the official score inside a battle ticket")
      .addIntegerOption((option) =>
        option.setName("score1").setDescription("Score for side 1 (left / player 1)").setRequired(true).setMinValue(0),
      )
      .addIntegerOption((option) =>
        option.setName("score2").setDescription("Score for side 2 (right / player 2)").setRequired(true).setMinValue(0),
      )
      .addStringOption((option) =>
        option.setName("note").setDescription("Optional note for the score upload log").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("correct")
      .setDescription("Amend a posted bracket score and rebuild lying rooms")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament whose bracket to correct")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("match")
          .setDescription("Completed match to amend")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addIntegerOption((option) =>
        option.setName("score1").setDescription("Corrected score for side 1").setRequired(true).setMinValue(0),
      )
      .addIntegerOption((option) =>
        option.setName("score2").setDescription("Corrected score for side 2").setRequired(true).setMinValue(0),
      ),
  );
