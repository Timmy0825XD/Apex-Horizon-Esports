import {
  ChannelType,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";

const postChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

function addPostChannel(
  subcommand: SlashCommandSubcommandBuilder,
  name: string,
  description: string,
  required: boolean,
) {
  return subcommand.addChannelOption((option) =>
    option.setName(name).setDescription(description).addChannelTypes(...postChannels).setRequired(required),
  );
}

export const utilitySlash = new SlashCommandBuilder()
  .setName("utility")
  .setDescription("Handy tools for this server")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("clear_category")
      .setDescription("Delete every channel in a category")
      .addChannelOption((option) =>
        option
          .setName("category")
          .setDescription("Category whose child channels will be deleted")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("clear")
      .setDescription("Delete messages in this channel")
      .addIntegerOption((option) =>
        option
          .setName("number")
          .setDescription("How many recent messages to delete (1–1000)")
          .setMinValue(1)
          .setMaxValue(1000)
          .setRequired(false),
      )
      .addIntegerOption((option) =>
        option
          .setName("days")
          .setDescription("Delete messages from the last 1–14 days")
          .setMinValue(1)
          .setMaxValue(14)
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("emoji_steal")
      .setDescription("Remove a server emoji and show its image")
      .addStringOption((option) =>
        option.setName("emoji_id").setDescription("Custom emoji or its ID").setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("random")
      .setDescription("Pick randomly from a list")
      .addStringOption((option) =>
        option.setName("options").setDescription("Choices separated by comma, pipe, or new line").setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("number")
          .setDescription("How many unique options to pick (default 1)")
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("utc")
      .setDescription("Build a UTC timestamp")
      .addIntegerOption((option) =>
        option.setName("hour").setDescription("Hour in UTC (0–23)").setMinValue(0).setMaxValue(23).setRequired(true),
      )
      .addIntegerOption((option) =>
        option.setName("minute").setDescription("Minute (0–59)").setMinValue(0).setMaxValue(59).setRequired(true),
      )
      .addIntegerOption((option) =>
        option.setName("day").setDescription("Day of month (1–31)").setMinValue(1).setMaxValue(31).setRequired(true),
      )
      .addIntegerOption((option) =>
        option.setName("month").setDescription("Month (1–12)").setMinValue(1).setMaxValue(12).setRequired(true),
      )
      .addIntegerOption((option) =>
        option.setName("year").setDescription("Year").setMinValue(2015).setMaxValue(2100).setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("discord_tag")
      .setDescription("Turn Discord IDs into usernames")
      .addStringOption((option) =>
        option.setName("ids").setDescription("Discord user IDs in the sheet order").setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("avatar")
      .setDescription("Show a user's avatar")
      .addUserOption((option) => option.setName("user").setDescription("Whose avatar to show (default: you)")),
  )
  .addSubcommand((subcommand) => subcommand.setName("toss").setDescription("Flip a coin"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("enlarge")
      .setDescription("Show an emoji at full size")
      .addStringOption((option) =>
        option.setName("emoji").setDescription("Custom or unicode emoji").setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    addPostChannel(
      subcommand.setName("embed").setDescription("Build an embed"),
      "channel",
      "Channel where the embed will be posted",
      true,
    ),
  )
  .addSubcommand((subcommand) =>
    addPostChannel(
      subcommand
        .setName("edit_embed")
        .setDescription("Edit an embed the bot posted")
        .addStringOption((option) =>
          option.setName("message_id").setDescription("ID of the bot message to rewrite").setRequired(true),
        ),
      "message_channel",
      "Channel that holds the message (default: here)",
      false,
    ),
  )
  .addSubcommand((subcommand) =>
    addPostChannel(
      subcommand.setName("v2").setDescription("Build a Components V2 message"),
      "channel",
      "Channel where the Components V2 message will be posted",
      true,
    ),
  )
  .addSubcommand((subcommand) =>
    addPostChannel(
      subcommand
        .setName("edit_v2")
        .setDescription("Edit a Components V2 message")
        .addStringOption((option) =>
          option.setName("message_id").setDescription("ID of the bot message to rewrite").setRequired(true),
        ),
      "message_channel",
      "Channel that holds the message (default: here)",
      false,
    ),
  );
