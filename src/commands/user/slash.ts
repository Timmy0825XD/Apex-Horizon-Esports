import { SlashCommandBuilder } from "discord.js";
import { banDurationChoices } from "./durations.js";

export const userSlash = new SlashCommandBuilder()
  .setName("user")
  .setDescription("Ban or unban a Discord user by ID")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ban")
      .setDescription("Ban a Discord ID for a set duration")
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
      .setDescription("Remove a tracked Discord ban")
      .addStringOption((option) =>
        option.setName("discord_id").setDescription("Discord user ID to unban").setRequired(true).setMaxLength(20),
      ),
  );
