import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

function addClock(subcommand: SlashCommandSubcommandBuilder, required: boolean): SlashCommandSubcommandBuilder {
  return subcommand
    .addIntegerOption((option) => option.setName("hour").setDescription("Hour").setMinValue(0).setMaxValue(23).setRequired(required))
    .addIntegerOption((option) => option.setName("minute").setDescription("Minute").setMinValue(0).setMaxValue(59).setRequired(required))
    .addIntegerOption((option) => option.setName("day").setDescription("Day").setMinValue(1).setMaxValue(31).setRequired(required))
    .addIntegerOption((option) => option.setName("month").setDescription("Month").setMinValue(1).setMaxValue(12).setRequired(required))
    .addIntegerOption((option) => option.setName("year").setDescription("Year").setMinValue(2024).setMaxValue(2100).setRequired(required));
}

export const scheduleSlash = new SlashCommandBuilder()
  .setName("schedule")
  .setDescription("Schedules")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    addClock(subcommand.setName("create").setDescription("UTC time"), true)
      .addUserOption((option) => option.setName("judge").setDescription("Judge"))
      .addUserOption((option) => option.setName("recorder").setDescription("Recorder"))
      .addStringOption((option) => option.setName("remark").setDescription("Note").setMaxLength(130)),
  )
  .addSubcommand((subcommand) =>
    addClock(subcommand.setName("update").setDescription("Edit"), false)
      .addUserOption((option) => option.setName("judge").setDescription("Judge"))
      .addUserOption((option) => option.setName("recorder").setDescription("Recorder"))
      .addStringOption((option) => option.setName("note").setDescription("Remark").setMaxLength(130))
      .addBooleanOption((option) => option.setName("remove_judge").setDescription("Clear judge"))
      .addBooleanOption((option) => option.setName("remove_recorder").setDescription("Clear recorder"))
      .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(300))
      .addBooleanOption((option) => option.setName("regenerate_image").setDescription("Thumbnail")),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("show")
      .setDescription("Show")
      .addStringOption((option) => option.setName("tournament").setDescription("Tournament").setRequired(true).setAutocomplete(true))
      .addStringOption((option) => option.setName("match").setDescription("Match").setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setDescription("Delete")
      .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(300)),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("unassigned")
      .setDescription("Open seats")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("Filter")
          .addChoices(
            { name: "Both empty", value: "all" },
            { name: "No judge", value: "missing_judge" },
            { name: "No recorder", value: "missing_recorder" },
            { name: "Either seat", value: "any" },
          ),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName("refresh").setDescription("Refresh"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("resign")
      .setDescription("Resign")
      .addStringOption((option) =>
        option
          .setName("role")
          .setDescription("Seat")
          .addChoices(
            { name: "Judge", value: "judge" },
            { name: "Recorder", value: "recorder" },
            { name: "Both", value: "both" },
          ),
      )
      .addStringOption((option) => option.setName("reason").setDescription("Use . if private").setMaxLength(300))
      .addBooleanOption((option) => option.setName("regenerate_image").setDescription("Thumbnail")),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("results")
      .setDescription("Result")
      .addIntegerOption((option) =>
        option.setName("team_1").setDescription("Team 1").setRequired(true).setMinValue(0).setMaxValue(99),
      )
      .addIntegerOption((option) =>
        option.setName("team_2").setDescription("Team 2").setRequired(true).setMinValue(0).setMaxValue(99),
      )
      .addStringOption((option) => option.setName("notes").setDescription("Notes").setMaxLength(500))
      .addAttachmentOption((option) => option.setName("image1").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image2").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image3").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image4").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image5").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image6").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image7").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image8").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image9").setDescription("Proof"))
      .addAttachmentOption((option) => option.setName("image10").setDescription("Proof")),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("results_delete")
      .setDescription("Undo result")
      .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(300)),
  );
