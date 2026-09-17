import {
  ChannelType,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";

const textChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

function addSettingsOptions(subcommand: SlashCommandSubcommandBuilder, required: boolean) {
  return subcommand
    .addRoleOption((option) =>
      option
        .setName("admin_role")
        .setDescription("Role that can administer the bot")
        .setRequired(required),
    )
    .addRoleOption((option) =>
      option
        .setName("verified_role")
        .setDescription("Role granted to verified members")
        .setRequired(required),
    )
    .addRoleOption((option) =>
      option
        .setName("bracket_admin")
        .setDescription("Role that can manage brackets")
        .setRequired(required),
    )
    .addChannelOption((option) =>
      option
        .setName("schedules_channel")
        .setDescription("Channel where match schedules are posted")
        .addChannelTypes(...textChannels)
        .setRequired(required),
    )
    .addChannelOption((option) =>
      option
        .setName("thumbnail_channel")
        .setDescription("Channel for schedule thumbnails")
        .addChannelTypes(...textChannels)
        .setRequired(required),
    )
    .addChannelOption((option) =>
      option
        .setName("bans_channel")
        .setDescription("Channel for ban notices")
        .addChannelTypes(...textChannels)
        .setRequired(required),
    )
    .addChannelOption((option) =>
      option
        .setName("challonge_logs")
        .setDescription("Channel for bracket and score logs")
        .addChannelTypes(...textChannels)
        .setRequired(required),
    )
    .addChannelOption((option) =>
      option
        .setName("bot_logs")
        .setDescription("Channel for general bot audit logs")
        .addChannelTypes(...textChannels)
        .setRequired(required),
    );
}

export const settingsSlash = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure server roles and audit channels")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    addSettingsOptions(subcommand.setName("set").setDescription("First-time server roles and log channels"), true),
  )
  .addSubcommand((subcommand) =>
    addSettingsOptions(
      subcommand.setName("edit").setDescription("Change a configured role or channel"),
      false,
    ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("show").setDescription("Review whether roles and channels still exist"),
  );
