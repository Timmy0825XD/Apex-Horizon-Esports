import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { attachResultsLinks } from "../schedule/results.js";
import { canUseAttendanceTools } from "../attendance/access.js";
import { attendanceAuditDetails, auditAttendance } from "../attendance/audit.js";
import { postEventsLinks, repaintAttendance } from "../attendance/messages.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { attendanceError, linksAddedMessage, stageLabel } from "../attendance/view.js";
import { v2Flags } from "../../lib/v2.js";
import { mergeYoutubeLinks } from "../attendance/youtube.js";
import { loadLinkedMatch } from "./load.js";

export async function handleLinkAdd(interaction: ChatInputCommandInteraction): Promise<void> {
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
  if (!canUseAttendanceTools(interaction, loaded.settings, loaded.staff) || interaction.user.id !== loaded.attendance.recorderId) {
    await editAttendance(interaction, {
      embeds: [attendanceError("Recorder only", "Only the recorder of this attendance can add recording links.")],
    });
    return;
  }
  const merged = mergeYoutubeLinks(loaded.attendance.links, interaction.options.getString("link", true));
  if (!merged.ok) {
    const copy = {
      empty: "Add at least one YouTube URL.",
      invalid: "All recording links must be valid YouTube URLs.",
      duplicate: "One of those links is already on this attendance.",
      too_many: "A maximum of 7 recording links is allowed.",
    }[merged.reason];
    await editAttendance(interaction, { embeds: [attendanceError("Links rejected", copy)] });
    return;
  }

  const eventsId = await postEventsLinks(
    guild,
    loaded.tournament,
    loaded.match,
    loaded.attendance.team1Score,
    loaded.attendance.team2Score,
    merged.added,
  );
  const eventsLinksMessageIds = eventsId
    ? [...loaded.attendance.eventsLinksMessageIds, eventsId]
    : loaded.attendance.eventsLinksMessageIds;
  const saved = await prisma.attendance.update({
    where: { id: loaded.attendance.id },
    data: { links: merged.links, eventsLinksMessageIds },
  });
  const room = await prisma.room.findUnique({
    where: {
      tournamentId_challongeMatchId: {
        tournamentId: loaded.tournament.id,
        challongeMatchId: loaded.match.challongeMatchId,
      },
    },
  });
  await repaintAttendance(guild, loaded.tournament, loaded.match, saved, room?.channelId ?? "");
  await attachResultsLinks(guild, loaded.tournament.id, loaded.match.challongeMatchId, merged.links).catch(() => undefined);
  await auditAttendance({
    guild,
    settings: loaded.settings,
    actor: interaction.user,
    action: "created",
    title: "Recording links added",
    summary: `Recording links were added to an attendance in **${loaded.tournament.name}**.`,
    details: attendanceAuditDetails({
      tournamentName: loaded.tournament.name,
      recorderId: loaded.attendance.recorderId,
      extra: [`**Added** \`${merged.added.length}\` · **Total** \`${merged.links.length}\``],
    }),
  });
  const card = linksAddedMessage({
    tournamentName: loaded.tournament.name,
    channelId: room?.channelId ?? null,
    stage: stageLabel(loaded.match),
    leftName: loaded.match.player1Name,
    rightName: loaded.match.player2Name,
    team1Score: saved.team1Score,
    team2Score: saved.team2Score,
    added: merged.added,
    total: merged.links.length,
    actorId: interaction.user.id,
    at: new Date(),
  });
  await interaction.editReply({
    content: null,
    embeds: [],
    components: card.components,
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
}
