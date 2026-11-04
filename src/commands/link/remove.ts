import type { StaffConfig } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import { isGuildAdmin, isOrganiser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { attachResultsLinks } from "../schedule/results.js";
import { attendanceAuditDetails, auditAttendance } from "../attendance/audit.js";
import { clearEventsPosts, repaintAttendance } from "../attendance/messages.js";
import { hasRecordingLink } from "../attendance/payroll.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { attendanceError, linksRemovedMessage, noRecordingLinksMessage, stageLabel } from "../attendance/view.js";
import { v2Flags } from "../../lib/v2.js";
import { loadLinkedMatch } from "./load.js";

export async function handleLinkDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [attendanceError("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferPublic(interaction);
  const loaded = await loadLinkedMatch(interaction);
  if (!loaded.ok) {
    await editAttendance(interaction, { embeds: [loaded.embed] });
    return;
  }
  const allowed =
    interaction.user.id === loaded.attendance.recorderId ||
    isGuildAdmin(interaction, loaded.settings) ||
    isOrganiser(interaction, loaded.staff as StaffConfig | null);
  if (!allowed) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Cannot remove links", "Only the recorder of this attendance, an admin, or an organiser can remove the links.")],
    });
    return;
  }

  const removed = loaded.attendance.links.filter((link) => link.trim().length > 0).length;
  const room = await prisma.room.findUnique({
    where: {
      tournamentId_challongeMatchId: {
        tournamentId: loaded.tournament.id,
        challongeMatchId: loaded.match.challongeMatchId,
      },
    },
  });
  const face = {
    tournamentName: loaded.tournament.name,
    channelId: room?.channelId ?? null,
    stage: stageLabel(loaded.match),
    leftName: loaded.match.player1Name,
    rightName: loaded.match.player2Name,
    team1Score: loaded.attendance.team1Score,
    team2Score: loaded.attendance.team2Score,
  };
  if (!hasRecordingLink(loaded.attendance.links)) {
    const notice = noRecordingLinksMessage(face);
    await interaction.editReply({
      components: notice.components,
      flags: v2Flags,
      allowedMentions: notice.allowedMentions,
    });
    return;
  }

  await clearEventsPosts(guild, loaded.tournament, loaded.attendance.eventsLinksMessageIds);
  const saved = await prisma.attendance.update({
    where: { id: loaded.attendance.id },
    data: { links: [], eventsLinksMessageIds: [] },
  });
  await repaintAttendance(guild, loaded.tournament, loaded.match, saved, room?.channelId ?? "");
  await attachResultsLinks(guild, loaded.tournament.id, loaded.match.challongeMatchId, []).catch(() => undefined);
  await auditAttendance({
    guild,
    settings: loaded.settings,
    actor: interaction.user,
    action: "deleted",
    title: "Recording links removed",
    summary: `Recording links were removed from an attendance in **${loaded.tournament.name}**.`,
    details: attendanceAuditDetails({
      tournamentName: loaded.tournament.name,
      recorderId: loaded.attendance.recorderId,
      extra: [`**Removed** \`${removed}\``],
    }),
  });
  const removedCard = linksRemovedMessage({
    ...face,
    guildId: guild.id,
    recorderId: loaded.attendance.recorderId,
    removed,
    actorId: interaction.user.id,
    at: new Date(),
  });
  await interaction.editReply({
    components: removedCard.components,
    flags: v2Flags,
    allowedMentions: removedCard.allowedMentions,
  });
}
