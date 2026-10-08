import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { attachResultsLinks } from "../schedule/results.js";
import { canUseAttendanceTools } from "../attendance/access.js";
import { attendanceAuditDetails, auditAttendance } from "../attendance/audit.js";
import { postEventsLinks, repaintAttendance } from "../attendance/messages.js";
import { deferPublic, editAttendance } from "../attendance/respond.js";
import { attendanceError } from "../attendance/view.js";
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
    description: "Recording Links Added",
    details: attendanceAuditDetails({
      tournamentName: loaded.tournament.name,
      recorderId: loaded.attendance.recorderId,
      extra: [`**Added:** \`${merged.added.length}\``, `**Total:** \`${merged.links.length}\``],
    }),
  });
  const noun = merged.added.length === 1 ? "link was" : "links were";
  await editAttendance(interaction, {
    content: `**${merged.added.length}** ${noun} added and the attendance embeds were updated.`,
  });
}
