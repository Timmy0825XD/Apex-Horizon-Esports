import { SlashCommandBuilder } from "discord.js";

export const ticketSlash = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Close, reopen, delete, or transcribe this ticket")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName("close").setDescription("Close this ticket"),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("reopen").setDescription("Reopen this ticket"),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("delete").setDescription("Delete this ticket"),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("transcript").setDescription("Generate this ticket's transcript again"),
  );
