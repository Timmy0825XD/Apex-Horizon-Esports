import { SlashCommandBuilder } from "discord.js";

export const getSlash = new SlashCommandBuilder()
  .setName("get")
  .setDescription("Read attendance history or export the workbook")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("attendance")
      .setDescription("Paged attendance history for one member")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true),
      )
      .addUserOption((option) => option.setName("user").setDescription("Member to look up").setRequired(true)),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("sheet")
      .setDescription("Ephemeral Excel of attendance, work, and salary")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("tournament_type")
          .setDescription("Shown for reference. Rates use the tournament format")
          .setRequired(true)
          .addChoices(
            { name: "1v1/2v2/3v3 (Per Match)", value: "per_match" },
            { name: "4v4/5v5 (Per Game)", value: "per_game" },
          ),
      )
      .addBooleanOption((option) =>
        option.setName("include_default_win_salary").setDescription("Include default-win rows").setRequired(true),
      ),
  );
