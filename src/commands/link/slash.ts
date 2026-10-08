import { SlashCommandBuilder } from "discord.js";

export const linkSlash = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Recording links for an attendance")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Add YouTube links to an attendance")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true),
      )
      .addStringOption((option) =>
        option.setName("match").setDescription("Match with an active attendance").setRequired(true).setAutocomplete(true),
      )
      .addStringOption((option) =>
        option.setName("link").setDescription("YouTube URLs separated by spaces").setRequired(true).setMaxLength(1000),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setDescription("Remove every recording link from an attendance")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true),
      )
      .addStringOption((option) =>
        option.setName("match").setDescription("Match with an active attendance").setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("missing")
      .setDescription("List attendances that still need a recording link")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true),
      )
      .addUserOption((option) => option.setName("user").setDescription("Only this person's pending links")),
  );
