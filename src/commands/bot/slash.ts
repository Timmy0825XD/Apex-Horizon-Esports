import { SlashCommandBuilder } from "discord.js";

export const botSlash = new SlashCommandBuilder()
  .setName("bot")
  .setDescription("Bot diagnostics and info")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName("ping").setDescription("Check WebSocket, command, and database latency"),
  )
  .addSubcommand((subcommand) => subcommand.setName("about").setDescription("Bot identity and runtime health"))
  .addSubcommand((subcommand) =>
    subcommand.setName("help").setDescription("Command map by section and who can use each one"),
  );
