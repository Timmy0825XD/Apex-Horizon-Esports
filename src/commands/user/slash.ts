import { SlashCommandBuilder } from "discord.js";
import { banDurationChoices } from "./durations.js";

export const userSlash = new SlashCommandBuilder()
  .setName("user")
  .setDescription("Ban or unban users by ID")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ban")
      .setDescription("Ban a user ID for a set time")
      .addStringOption((option) =>
        option.setName("discord_id").setDescription("Discord user ID to ban").setRequired(true).setMaxLength(20),
      )
      .addStringOption((option) =>
        option
          .setName("time")
          .setDescription("How long the ban lasts")
          .setRequired(true)
          .addChoices(...banDurationChoices),
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("Reason stored with the ban").setRequired(false).setMaxLength(512),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("unban")
      .setDescription("Remove a user's ban")
      .addStringOption((option) =>
        option.setName("discord_id").setDescription("Discord user ID to unban").setRequired(true).setMaxLength(20),
      ),
  );
