import { SlashCommandBuilder } from "discord.js";

export const ticketSlash = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Close, reopen, or delete the current battle ticket")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName("close").setDescription("Silence this ticket and move it to the closed category"),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("reopen").setDescription("Restore chat access and move this ticket back to open"),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("delete").setDescription("Delete this ticket channel and forget the match link"),
  );
