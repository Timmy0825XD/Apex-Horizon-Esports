import type { ChatInputCommandInteraction } from "discord.js";
import { errorEmbed } from "../../lib/embeds.js";
import { prisma } from "../../lib/prisma.js";
import { attachResultsLinks } from "../schedule/results.js";
import { loadTicket } from "../schedule/ticket.js";
import { loadGuildStaffState } from "../staff/store.js";
import { attendanceAuditDetails, auditAttendance } from "./audit.js";
import { canMarkAttendance } from "./access.js";
import { clearEventsPosts, deletePosted, postEventsLinks, postMarkedPair } from "./messages.js";
import { isDefaultWin } from "./payroll.js";
import { deferHidden, editAttendance } from "./respond.js";
import { findActiveAttendance } from "./store.js";
import { readYoutubeLinks } from "./youtube.js";

export async function handleAttendanceMark(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("Guild only", "This command can only be used in a server.")] });
    return;
  }
  await deferHidden(interaction);
  const bundle = await loadTicket(interaction);
  if (typeof bundle === "string") {
    await editAttendance(interaction, { embeds: [errorEmbed("Ticket required", bundle)] });
    return;
  }
  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!staff) {
    await editAttendance(interaction, { embeds: [errorEmbed("Staff not configured", "Staff roles are not configured yet.")] });
    return;
  }
  if (!canMarkAttendance(interaction, settings, staff)) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Attendance staff only", "You need the **Judge** role, the **Recorder** role, or organiser access to mark attendance.")],
    });
    return;
  }
  if (!bundle.schedule) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Schedule required", "A schedule must exist for this match before attendance can be marked.")],
    });
    return;
  }
  if (bundle.schedule.scheduledAt.getTime() > Date.now()) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Too early", "Attendance cannot be marked before the scheduled time.")],
    });
    return;
  }
  const existing = await findActiveAttendance(guild.id, bundle.tournament.id, bundle.match.challongeMatchId);
  if (existing) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Attendance exists", "This ticket already has an attendance record.")],
    });
    return;
  }

  const judge = interaction.options.getUser("judge", true);
  const recorder = interaction.options.getUser("recorder", true);
  const judgeMember = await guild.members.fetch(judge.id).catch(() => null);
  if (!judgeMember) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Judge missing", "The selected judge is not a member of this server.")],
    });
    return;
  }
  if (!judgeMember.roles.cache.has(staff.judgeRoleId)) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Judge role required", "The selected user does not have the Judge role.")],
    });
    return;
  }
  const recorderMember = await guild.members.fetch(recorder.id).catch(() => null);
  if (!recorderMember) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Recorder missing", "The selected recorder is not a member of this server.")],
    });
    return;
  }
  if (!recorderMember.roles.cache.has(staff.recorderRoleId)) {
    await editAttendance(interaction, {
      embeds: [errorEmbed("Recorder role required", "The selected user does not have the Recorder role.")],
    });
    return;
  }

  const parsedLinks = readYoutubeLinks(interaction.options.getString("link"), false);
  if (!parsedLinks.ok) {
    const copy =
      parsedLinks.reason === "too_many"
        ? "A maximum of 7 recording links is allowed."
        : "All recording links must be valid YouTube URLs.";
    await editAttendance(interaction, { embeds: [errorEmbed("Invalid links", copy)] });
    return;
  }

  const remarkRaw = interaction.options.getString("remark")?.trim() ?? "";
  const remark = remarkRaw ? (isDefaultWin(remarkRaw) ? "DW" : remarkRaw.slice(0, 32)) : null;
  const team1Score = interaction.options.getInteger("team1_score", true);
  const team2Score = interaction.options.getInteger("team2_score", true);
  const posted = await postMarkedPair(guild, bundle.channel, bundle.tournament, bundle.match, {
    judgeId: judge.id,
    recorderId: recorder.id,
    team1Score,
    team2Score,
    links: parsedLinks.links,
    remark,
    uploadedBy: interaction.user.id,
    markedAt: new Date(),
  });
  if (typeof posted === "string") {
    await editAttendance(interaction, { embeds: [errorEmbed("Attendance channel", posted)] });
    return;
  }

  const raced = await findActiveAttendance(guild.id, bundle.tournament.id, bundle.match.challongeMatchId);
  if (raced) {
    await deletePosted([posted.ticketMessage, posted.attendanceMessage]);
    await editAttendance(interaction, {
      embeds: [errorEmbed("Attendance exists", "This ticket already has an attendance record.")],
    });
    return;
  }

  const eventsId = await postEventsLinks(guild, bundle.tournament, bundle.match, team1Score, team2Score, parsedLinks.links);
  try {
    await prisma.attendance.create({
      data: {
        guildId: guild.id,
        tournamentId: bundle.tournament.id,
        challongeMatchId: bundle.match.challongeMatchId,
        scheduleId: bundle.schedule.id,
        judgeId: judge.id,
        recorderId: recorder.id,
        team1Score,
        team2Score,
        remark,
        links: parsedLinks.links,
        eventsLinksMessageIds: eventsId ? [eventsId] : [],
        ticketMessageId: posted.ticketMessage.id,
        attendanceChannelMessageId: posted.attendanceMessage.id,
        createdBy: interaction.user.id,
        deletedAt: null,
      },
    });
  } catch {
    await deletePosted([posted.ticketMessage, posted.attendanceMessage]);
    if (eventsId) {
      await clearEventsPosts(guild, bundle.tournament, [eventsId]);
    }
    await editAttendance(interaction, {
      embeds: [errorEmbed("Attendance was not saved", "The posts were removed. Run the command again.")],
    });
    return;
  }

  await attachResultsLinks(guild, bundle.tournament.id, bundle.match.challongeMatchId, parsedLinks.links).catch(() => undefined);
  await auditAttendance({
    guild,
    settings,
    actor: interaction.user,
    description: "Attendance Marked",
    details: attendanceAuditDetails({
      tournamentName: bundle.tournament.name,
      channelId: bundle.channel.id,
      judgeId: judge.id,
      recorderId: recorder.id,
      score: `\`${team1Score}\` - \`${team2Score}\``,
      extra: [`**Links:** \`${parsedLinks.links.length}\``],
    }),
  });
  await interaction.deleteReply().catch(() => undefined);
}
