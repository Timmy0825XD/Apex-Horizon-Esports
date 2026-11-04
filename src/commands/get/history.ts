import type { ChatInputCommandInteraction } from "discord.js";
import { actorMatches } from "../../lib/command-access.js";
import { v2Flags } from "../../lib/v2.js";
import { watchPanelButtons } from "../attendance/buttons.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { findGuildTournament, listUserAttendance, matchesById } from "../attendance/store.js";
import { attendanceError, historyEntry, historyMessage } from "../attendance/view.js";

const PAGE = 5;

export async function handleGetAttendance(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [attendanceError("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferPublic(interaction);
  if (
    !(await actorMatches(interaction, {
      admin: true,
      organiser: true,
      helper: true,
      staff: true,
      judge: true,
      recorder: true,
    }))
  ) {
    await editAttendance(interaction, {
      embeds: [
        attendanceError(
          "Staff only",
          "You need **staff**, **judge**, **recorder**, **helper**, **Admin**, or **Organiser** to view attendance.",
        ),
      ],
    });
    return;
  }
  const tournament = await findGuildTournament(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Unknown tournament", "Pick a tournament from the autocomplete list.")],
    });
    return;
  }
  const user = interaction.options.getUser("user", true);
  const rows = await listUserAttendance(guild.id, tournament.id, user.id);
  const faces = await matchesById(
    tournament.id,
    rows.map((row) => row.challongeMatchId),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  let page = 0;
  const view = (disabled = false) =>
    historyMessage({
      userId: user.id,
      avatarUrl: user.displayAvatarURL({ extension: "png", size: 256 }),
      tournamentName: tournament.name,
      total: rows.length,
      page,
      pages,
      lines: rows
        .slice(page * PAGE, page * PAGE + PAGE)
        .map((row) => historyEntry(user.id, row, faces.get(row.challongeMatchId))),
      disabled,
    });
  const opened = view();
  const message = await interaction.editReply({
    content: null,
    embeds: [],
    components: opened.components,
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
  if (pages <= 1) {
    return;
  }
  await watchPanelButtons(
    interaction,
    message,
    (customId) => {
      if (customId.endsWith(":prev")) {
        page = Math.max(0, page - 1);
      }
      if (customId.endsWith(":next")) {
        page = Math.min(pages - 1, page + 1);
      }
      return view();
    },
    () => view(true),
  );
}
