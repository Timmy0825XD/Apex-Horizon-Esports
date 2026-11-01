import { SlashCommandBuilder } from "discord.js";

export const botSlash = new SlashCommandBuilder()
  .setName("bot")
  .setDescription("Bot info and diagnostics")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName("ping").setDescription("Check bot and database latency"),
  )
  .addSubcommand((subcommand) => subcommand.setName("about").setDescription("Show bot info and status"))
  .addSubcommand((subcommand) =>
    subcommand.setName("help").setDescription("List commands and who can use them"),
  );
