import { SlashCommandBuilder } from "discord.js";

export const roomSlash = new SlashCommandBuilder()
  .setName("room")
  .setDescription("Open battle tickets or check the queue")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Open pending battle tickets now")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament whose waiting tickets to open")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("group")
          .setDescription("Only matches in this group")
          .setRequired(false)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("round")
          .setDescription("Only matches in this round")
          .setRequired(false)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("available")
      .setDescription("List matches without a battle ticket")
      .addStringOption((option) =>
        option
          .setName("tournament")
          .setDescription("Tournament to inspect")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("auto")
      .setDescription("Turn automatic battle tickets on or off")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament to update").setRequired(true).setAutocomplete(true),
      )
      .addBooleanOption((option) =>
        option
          .setName("status")
          .setDescription("On opens ready matches now, then waits for 00:00 and 12:00 UTC")
          .setRequired(true),
      ),
  );
