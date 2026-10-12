import { SlashCommandBuilder } from "discord.js";

export const sheetSlash = new SlashCommandBuilder()
  .setName("sheet")
  .setDescription("Archive, look up, and quality-check participant sheets")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Archive participant sheets into the global player search")
      .addStringOption((option) =>
        option.setName("link").setDescription("Google Sheet URL (required with name)").setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Tournament name for that sheet (required with link)")
          .setRequired(false)
          .setMaxLength(100),
      )
      .addAttachmentOption((option) =>
        option
          .setName("csv")
          .setDescription("Bulk: column 1 = tournament name, column 2 = sheet URL, no header")
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("get")
      .setDescription("Get a stored sheet link by tournament name, or export every sheet as CSV")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Tournament name in the global sheet archive")
          .setRequired(false)
          .setAutocomplete(true),
      )
      .addBooleanOption((option) =>
        option.setName("csv").setDescription("Export every stored tournament and its sheet as a CSV").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("find_player")
      .setDescription("Search every stored sheet across all servers")
      .addStringOption((option) => option.setName("game_id").setDescription("In-game ID").setRequired(false))
      .addStringOption((option) =>
        option.setName("discord_id").setDescription("Discord user ID").setRequired(false),
      )
      .addStringOption((option) =>
        option.setName("discord_tag").setDescription("Discord tag / username").setRequired(false),
      )
      .addStringOption((option) =>
        option.setName("player_name").setDescription("In-game name").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("validate")
      .setDescription("Quality-check a participant sheet before creating a tournament")
      .addStringOption((option) =>
        option.setName("sheet_link").setDescription("Google Sheet of participants").setRequired(true),
      ),
  );
