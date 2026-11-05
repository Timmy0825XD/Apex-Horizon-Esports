import { SlashCommandBuilder } from "discord.js";

export const panelSlash = new SlashCommandBuilder()
  .setName("panel")
  .setDescription("Post informative panels for the staff")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand.setName("tutorial").setDescription("Pick commands and post a staff guide for each one"),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("tournament")
      .setDescription("Post a tournament information panel in this channel")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("rules")
          .setDescription("Post the Spanish and English rules links")
          .addStringOption((option) => option.setName("name").setDescription("Tournament name shown on the panel").setRequired(true).setMaxLength(100))
          .addStringOption((option) => option.setName("spanish").setDescription("Link to the rules in Spanish").setRequired(true).setMaxLength(500))
          .addStringOption((option) => option.setName("english").setDescription("Link to the rules in English").setRequired(true).setMaxLength(500))
          .addAttachmentOption((option) => option.setName("image").setDescription("Image shown on the rules panel").setRequired(false)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("bracket")
          .setDescription("Post the Challonge bracket and the team shuffle video")
          .addStringOption((option) => option.setName("name").setDescription("Tournament name shown on the panel").setRequired(true).setMaxLength(100))
          .addStringOption((option) => option.setName("bracket").setDescription("Link to the Challonge bracket").setRequired(true).setMaxLength(500))
          .addStringOption((option) => option.setName("shuffle").setDescription("YouTube video of the team shuffle").setRequired(true).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("deadline")
          .setDescription("Post the dates of every round and ping the participants")
          .addStringOption((option) => option.setName("name").setDescription("Tournament name shown on the panel").setRequired(true).setMaxLength(100))
          .addRoleOption((option) => option.setName("role").setDescription("Participants role to ping").setRequired(true)),
      ),
  );
