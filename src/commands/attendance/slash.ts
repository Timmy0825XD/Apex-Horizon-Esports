import { SlashCommandBuilder } from "discord.js";

export const attendanceSlash = new SlashCommandBuilder()
  .setName("attendance")
  .setDescription("Match attendance and one person's salary")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("mark")
      .setDescription("Record judge, recorder, score, and optional YouTube links")
      .addUserOption((option) => option.setName("judge").setDescription("Member with the Judge role").setRequired(true))
      .addUserOption((option) => option.setName("recorder").setDescription("Member with the Recorder role").setRequired(true))
      .addIntegerOption((option) =>
        option.setName("team1_score").setDescription("Score for side 1").setRequired(true).setMinValue(0),
      )
      .addIntegerOption((option) =>
        option.setName("team2_score").setDescription("Score for side 2").setRequired(true).setMinValue(0),
      )
      .addStringOption((option) =>
        option.setName("remark").setDescription("DW marks a default win").setAutocomplete(true).setMaxLength(32),
      )
      .addStringOption((option) =>
        option.setName("link").setDescription("YouTube URLs separated by spaces, up to 7").setMaxLength(1000),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setDescription("Soft-delete the attendance in this ticket")
      .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm the delete").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Why this attendance is being removed").setMaxLength(500)),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("Salary card for one person in a tournament")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true),
      )
      .addUserOption((option) => option.setName("user").setDescription("Whose salary to show (default: you)")),
  );
