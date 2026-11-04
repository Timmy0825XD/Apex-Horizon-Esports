import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { v2Flags } from "../../lib/v2.js";
import { canUseAttendanceTools } from "../attendance/access.js";
import { watchPanelButtons } from "../attendance/buttons.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { findGuildTournament, isObjectId, listMissingLinks, matchesById } from "../attendance/store.js";
import { attendanceError, missingEntry, missingMessage } from "../attendance/view.js";
import { loadGuildStaffState } from "../staff/store.js";

const PAGE = 10;

async function ticketChannels(tournamentId: string, matchIds: number[]): Promise<Map<number, string>> {
  if (matchIds.length === 0) {
    return new Map();
  }
  const rooms = await prisma.room.findMany({
    where: { tournamentId, challongeMatchId: { in: [...new Set(matchIds)] } },
    select: { challongeMatchId: true, channelId: true },
  });
  return new Map(rooms.map((room) => [room.challongeMatchId, room.channelId]));
}

export async function handleLinkMissing(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [attendanceError("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferPublic(interaction);
  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!canUseAttendanceTools(interaction, settings, staff)) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Staff only", "You need a staff, judge, or recorder role to list missing links.")],
    });
    return;
  }

  const rawTournament = interaction.options.getString("tournament", true);
  if (!isObjectId(rawTournament)) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Unknown tournament", "Pick a tournament from the autocomplete list.")],
    });
    return;
  }
  const tournament = await findGuildTournament(guild.id, rawTournament);
  if (!tournament) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Unknown tournament", "Pick a tournament from the autocomplete list.")],
    });
    return;
  }

  const target = interaction.options.getUser("user");
  const rows = await listMissingLinks(guild.id, tournament.id, target?.id ?? null);
  const matchIds = rows.map((row) => row.challongeMatchId);
  const faces = await matchesById(tournament.id, matchIds);
  const tickets = await ticketChannels(tournament.id, matchIds);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  let page = 0;
  const view = (disabled = false) => {
    const start = page * PAGE;
    const lines = rows
      .slice(start, start + PAGE)
      .map((row, offset) =>
        missingEntry(start + offset + 1, row, faces.get(row.challongeMatchId), tickets.get(row.challongeMatchId) ?? null),
      );
    return missingMessage({
      guildId: guild.id,
      tournamentName: tournament.name,
      total: rows.length,
      page,
      pages,
      lines,
      recorderId: target?.id ?? null,
      disabled,
    });
  };
  const opened = view();
  const message = await interaction.editReply({
    components: opened.components,
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
  if (rows.length <= PAGE) {
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
