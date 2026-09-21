import {
  ChannelType,
  SlashCommandBuilder,
  type SlashCommandSubcommandBuilder,
} from "discord.js";

const textChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;
const categories = [ChannelType.GuildCategory] as const;

function addRole(subcommand: SlashCommandSubcommandBuilder, name: string, description: string, required: boolean) {
  return subcommand.addRoleOption((option) =>
    option.setName(name).setDescription(description).setRequired(required),
  );
}

function addTextChannel(
  subcommand: SlashCommandSubcommandBuilder,
  name: string,
  description: string,
  required: boolean,
) {
  return subcommand.addChannelOption((option) =>
    option.setName(name).setDescription(description).addChannelTypes(...textChannels).setRequired(required),
  );
}

function addCategory(
  subcommand: SlashCommandSubcommandBuilder,
  name: string,
  description: string,
  required: boolean,
) {
  return subcommand.addChannelOption((option) =>
    option.setName(name).setDescription(description).addChannelTypes(...categories).setRequired(required),
  );
}

function addSharedWorldOptions(subcommand: SlashCommandSubcommandBuilder, required: boolean) {
  addRole(subcommand, "admin_role", "Organizer role for this tournament", required);
  addRole(subcommand, "helper_role", "Helper role for this tournament", required);
  addTextChannel(subcommand, "attendance_channel", "Channel for attendance embeds", required);
  addTextChannel(subcommand, "transcript_channel", "Channel for HTML transcripts", required);
  addTextChannel(subcommand, "rules_channel", "Channel with the ruleset", required);
  addTextChannel(subcommand, "deadline_channel", "Channel for deadlines and info", required);
  addTextChannel(subcommand, "result_channel", "Channel for /schedule results", required);
  addCategory(subcommand, "closed_ticket_category", "Category for closed tickets", required);
  addCategory(subcommand, "ticket_open_category_1", "First open-ticket category", required);
  addCategory(subcommand, "ticket_open_category_2", "Overflow open-ticket category", required);
  subcommand.addBooleanOption((option) =>
    option
      .setName("auto_room_creation")
      .setDescription("Allow auto-room for this tournament (does not open rooms by itself)")
      .setRequired(required),
  );
  addCategory(subcommand, "close_ticket_category_2", "Overflow category for closed tickets", false);
  addCategory(subcommand, "ticket_open_category_3", "Third open-ticket category", false);
  addCategory(subcommand, "ticket_open_category_4", "Fourth open-ticket category", false);
  addTextChannel(subcommand, "events_links", "Channel for YouTube recording posts", false);
  return subcommand;
}

function addCreateOptions(subcommand: SlashCommandSubcommandBuilder) {
  subcommand
    .addStringOption((option) =>
      option.setName("name").setDescription("Visible tournament name").setRequired(true).setMaxLength(100),
    )
    .addStringOption((option) =>
      option.setName("id").setDescription("Challonge tournament URL or ID").setRequired(true).setMaxLength(200),
    )
    .addStringOption((option) =>
      option.setName("key").setDescription("Challonge API key (stored encrypted)").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("sheet_link").setDescription("Google Sheet of participants").setRequired(true),
    );
  return addSharedWorldOptions(subcommand, true);
}

function addEditOptions(subcommand: SlashCommandSubcommandBuilder) {
  subcommand
    .addStringOption((option) =>
      option.setName("id").setDescription("Tournament to edit").setRequired(true).setAutocomplete(true),
    )
    .addStringOption((option) =>
      option.setName("name").setDescription("Visible tournament name").setRequired(false).setMaxLength(100),
    )
    .addStringOption((option) =>
      option.setName("key").setDescription("Challonge API key (stored encrypted)").setRequired(false),
    )
    .addStringOption((option) =>
      option.setName("sheet_link").setDescription("Google Sheet of participants").setRequired(false),
    );
  return addSharedWorldOptions(subcommand, false);
}

export const tournamentSlash = new SlashCommandBuilder()
  .setName("tournament")
  .setDescription("Register and maintain tournament worlds")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    addCreateOptions(subcommand.setName("add").setDescription("Register a tournament (bracket, sheet, rooms, channels)")),
  )
  .addSubcommand((subcommand) =>
    addEditOptions(subcommand.setName("edit").setDescription("Patch a registered tournament world")),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setDescription("Forget the tournament and its bot records; keep the stored sheet")
      .addStringOption((option) =>
        option.setName("id").setDescription("Tournament to delete").setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add_sheet")
      .setDescription("Archive participant sheets into the global player search")
      .addStringOption((option) =>
        option.setName("link").setDescription("Google Sheet URL (required with name)").setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Tournament name for that sheet (required with link)")
          .setRequired(false)
          .setMaxLength(100),
      )
      .addAttachmentOption((option) =>
        option
          .setName("csv")
          .setDescription("Bulk: column 1 = tournament name, column 2 = sheet URL, no header")
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("get_sheet")
      .setDescription("Get a stored sheet link by tournament name, or export every sheet as CSV")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Tournament name in the global sheet archive")
          .setRequired(false)
          .setAutocomplete(true),
      )
      .addBooleanOption((option) =>
        option.setName("csv").setDescription("Export every stored tournament and its sheet as a CSV").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("find_player")
      .setDescription("Search every stored sheet across all servers")
      .addStringOption((option) => option.setName("game_id").setDescription("In-game ID").setRequired(false))
      .addStringOption((option) =>
        option.setName("discord_id").setDescription("Discord user ID").setRequired(false),
      )
      .addStringOption((option) =>
        option.setName("discord_tag").setDescription("Discord tag / username").setRequired(false),
      )
      .addStringOption((option) =>
        option.setName("player_name").setDescription("In-game name").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("Show one tournament world")
      .addStringOption((option) =>
        option.setName("id").setDescription("Tournament to show").setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("list").setDescription("List tournaments registered in this server"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("role")
      .setDescription("Give a Discord role to tournament participants")
      .addStringOption((option) =>
        option.setName("tournament").setDescription("Tournament whose players to role").setRequired(true).setAutocomplete(true),
      )
      .addRoleOption((option) =>
        option.setName("role").setDescription("Role to give").setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("id_header")
          .setDescription("Discord ID column to role. Leave empty to role every player")
          .setRequired(false)
          .setAutocomplete(true),
      ),
  );
