import { SlashCommandBuilder, type SlashCommandSubcommandBuilder } from "discord.js";

function addExcelOption(subcommand: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder {
  return subcommand.addBooleanOption((option) =>
    option
      .setName("excel")
      .setDescription("Generate an Excel workbook instead of a .txt file")
      .setRequired(false),
  );
}

export const serverSlash = new SlashCommandBuilder()
  .setName("server")
  .setDescription("Server snapshot, bans, channel tree, and invites")
  .setDMPermission(false)
  .addSubcommand((subcommand) => subcommand.setName("info").setDescription("Live server statistics"))
  .addSubcommand((subcommand) =>
    addExcelOption(
      subcommand.setName("banlist").setDescription("Export the server ban list as a text file or Excel workbook"),
    ),
  )
  .addSubcommand((subcommand) =>
    addExcelOption(subcommand.setName("tree").setDescription("Export the category and channel tree")),
  )
  .addSubcommand((subcommand) =>
    addExcelOption(
      subcommand.setName("invites").setDescription("Export active invites, including vanity if set"),
    ),
  );
