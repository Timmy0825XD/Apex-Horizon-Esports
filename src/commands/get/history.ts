import type { Attendance, Match } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import { canUseAttendanceTools } from "../attendance/access.js";
import { watchButtons } from "../attendance/buttons.js";
import { hasRecordingLink, isDefaultWin } from "../attendance/payroll.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { findGuildTournament, listUserAttendance, matchesById } from "../attendance/store.js";
import { attendanceError, historyEmbed, matchSummary, pagerRow, roleLabel } from "../attendance/view.js";
import { loadGuildStaffState } from "../staff/store.js";

const PAGE = 5;

function relative(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function linkStatus(row: Attendance): string {
  if (hasRecordingLink(row.links)) {
    return `${row.links.length} link(s)`;
  }
  if (isDefaultWin(row.remark)) {
    return "Link not required";
  }
  return "Missing links";
}

function line(userId: string, row: Attendance, match: Match | undefined): string {
  const links = linkStatus(row);
  const dw = isDefaultWin(row.remark) ? " · `DW`" : "";
  return [
    matchSummary(match ?? null, row.challongeMatchId),
    `**${roleLabel(userId, row.judgeId, row.recorderId)}** · \`${row.team1Score}\` - \`${row.team2Score}\` · ${links}${dw}`,
    relative(row.createdAt),
  ].join("\n");
}

export async function handleGetAttendance(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [attendanceError("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferPublic(interaction);
  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!canUseAttendanceTools(interaction, settings, staff)) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Staff only", "You need a staff, judge, or recorder role to view attendance.")],
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
  const view = () => {
    const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
    return {
      embeds: [
        historyEmbed({
          tournamentName: tournament.name,
          page,
          pages: rows.length === 0 ? 1 : pages,
          lines: rows.length === 0 ? ["*No attendance records for this member.*"] : slice.map((row) => line(user.id, row, faces.get(row.challongeMatchId))),
        }),
      ],
      components: rows.length > PAGE ? [pagerRow("att:hist", page, pages)] : [],
    };
  };
  const first = view();
  const message = await interaction.editReply({ ...first, allowedMentions: { parse: [] } });
  if (first.components.length === 0) {
    return;
  }
  await watchButtons(interaction, message, first.components, (customId) => {
    if (customId.endsWith(":prev")) {
      page = Math.max(0, page - 1);
    }
    if (customId.endsWith(":next")) {
      page = Math.min(pages - 1, page + 1);
    }
    return view();
  });
}
