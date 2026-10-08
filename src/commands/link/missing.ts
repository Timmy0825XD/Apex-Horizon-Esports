import type { Attendance, Match } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";
import { canUseAttendanceTools } from "../attendance/access.js";
import { watchSalaryButtons } from "../attendance/buttons.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { findGuildTournament, isObjectId, listMissingLinks, matchesById } from "../attendance/store.js";
import { attendanceError, missingMessage } from "../attendance/view.js";
import { v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { loadGuildStaffState } from "../staff/store.js";

const PAGE = 10;

function relative(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function entry(index: number, row: Attendance, match: Match | undefined, tags: Map<string, string>): string {
  const face = match
    ? `${emojis.vs} ${escapeDiscord(match.player1Name)} vs ${escapeDiscord(match.player2Name)}. (ID: \`${row.challongeMatchId}\`)`
    : `Match \`${row.challongeMatchId}\``;
  const tag = tags.get(row.recorderId);
  const who = tag ? `${formatUser(row.recorderId)} (${escapeDiscord(tag)})` : formatUser(row.recorderId);
  return [
    `**${index}.** ${face}`,
    `> ${emojis.recorder} **Recorder:** ${who}`,
    `> ${emojis.calendar} **Submitted:** ${relative(row.createdAt)}`,
    `> ${emojis.link} **Status:** Awaiting Link`,
  ].join("\n");
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
  const faces = await matchesById(
    tournament.id,
    rows.map((row) => row.challongeMatchId),
  );
  const tags = new Map<string, string>();
  const recorderIds = [...new Set(rows.map((row) => row.recorderId))];
  if (recorderIds.length > 0) {
    const members = await guild.members.fetch({ user: recorderIds }).catch(() => null);
    for (const id of recorderIds) {
      const username = members?.get(id)?.user.username;
      if (username) {
        tags.set(id, username);
      }
    }
  }
  const userLine = target
    ? `${emojis.recorder} **User:** ${formatUser(target.id)} (${escapeDiscord(target.username)})`
    : null;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  let page = 0;
  const view = (disabled = false) => {
    const start = page * PAGE;
    const lines = rows.slice(start, start + PAGE).map((row, offset) =>
      entry(start + offset + 1, row, faces.get(row.challongeMatchId), tags),
    );
    return missingMessage({
      tournamentName: tournament.name,
      total: rows.length,
      page,
      pages,
      lines,
      userLine,
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
  await watchSalaryButtons(
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
