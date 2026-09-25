import { MessageFlags, type ButtonInteraction, type Guild } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
import { loadGuildStaffState } from "../staff/store.js";
import { findTournamentById } from "../tournament/store.js";
import { isJudge, isRecorder } from "./access.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { grantTicket, ticketChannel } from "./channel.js";
import { paintSchedule } from "./live.js";
import { formatUser } from "../../lib/formatters.js";
import { scheduleNotice } from "./respond.js";
import { postSeatLine, seatAssignedLine } from "./seat.js";
import { claimsAreOpen, confirmRow, parseScheduleButton } from "./view.js";

function privateReply(interaction: ButtonInteraction, kind: "error" | "success" | "info", title: string, body: string) {
  const notice = scheduleNotice(kind, title, body);
  const flags = [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] as const;
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ components: notice.components, flags: [MessageFlags.IsComponentsV2] });
  }
  return interaction.reply({ ...notice, flags });
}

export async function handleScheduleButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseScheduleButton(interaction.customId);
  const guild = interaction.guild;
  if (!parsed || !guild) {
    return;
  }
  const schedule = await prisma.schedule.findUnique({ where: { id: parsed.scheduleId } });
  if (!schedule || schedule.guildId !== guild.id) {
    await privateReply(interaction, "error", "Schedule missing", "That schedule is no longer active.");
    return;
  }
  if (parsed.action === "claim") {
    await claimSeat(interaction, guild, schedule, parsed.seat);
    return;
  }
  await confirmSeat(interaction, guild, schedule, parsed.seat);
}

async function claimSeat(interaction: ButtonInteraction, guild: Guild, schedule: NonNullable<Awaited<ReturnType<typeof prisma.schedule.findUnique>>>, seat: "judge" | "recorder"): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { staff } = await loadGuildStaffState(guild.id);
  const settings = await loadGuildSettings(guild.id);
  if (!staff || !settings) {
    await privateReply(interaction, "error", "Staff not configured", "Staff roles are not configured yet.");
    return;
  }
  const allowed = seat === "judge" ? isJudge(interaction, staff) : isRecorder(interaction, staff);
  if (!allowed) {
    await privateReply(
      interaction,
      "error",
      seat === "judge" ? "Judge role required" : "Recorder role required",
      "That seat is only for members who hold the matching role.",
    );
    return;
  }
  if (!claimsAreOpen(schedule.claimsOpenUntil)) {
    await privateReply(interaction, "error", "Buttons locked", "Claim buttons are locked. Staff can run refresh to open them for 10 minutes.");
    return;
  }
  if ((seat === "judge" && schedule.judgeId) || (seat === "recorder" && schedule.recorderId)) {
    const label = seat === "judge" ? "judge" : "recorder";
    await privateReply(interaction, "error", "Seat taken", `A ${label} is already assigned.`);
    return;
  }
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
  const ticket = await ticketChannel(guild, schedule.channelId);
  if (!tournament || !match || !ticket) {
    await privateReply(interaction, "error", "Ticket missing", "The battle ticket for this schedule could not be opened.");
    return;
  }
  await grantTicket(ticket, interaction.user.id);
  const next = await prisma.schedule.update({
    where: { id: schedule.id },
    data: seat === "judge" ? { judgeId: interaction.user.id, confirmations: { ...schedule.confirmations, judge: false } } : { recorderId: interaction.user.id, confirmations: { ...schedule.confirmations, recorder: false } },
  });
  await paintSchedule(guild, ticket, settings, tournament, match, next, false);
  const label = seat === "judge" ? "Judge" : "Recorder";
  await postSeatLine(ticket, seatAssignedLine(seat, interaction.user.id), interaction.user.id);
  await privateReply(interaction, "success", "Seat claimed", `You are now assigned as **${label}** for this match.`);
  await auditSchedule({
    guild,
    settings,
    actor: interaction.user,
    description: `A ${seat} claimed a schedule in **${tournament.name}**.`,
    details: [ticketLine(guild, ticket.id), peopleLine(next.judgeId, next.recorderId)],
  });
}

async function confirmSeat(interaction: ButtonInteraction, guild: Guild, schedule: NonNullable<Awaited<ReturnType<typeof prisma.schedule.findUnique>>>, seat: "judge" | "recorder"): Promise<void> {
  const holder = seat === "judge" ? schedule.judgeId : schedule.recorderId;
  if (holder !== interaction.user.id) {
    await privateReply(interaction, "error", "Not your seat", "Only the person assigned to that seat can confirm.");
    return;
  }
  if (Date.now() >= schedule.scheduledAt.getTime()) {
    await privateReply(interaction, "error", "Match started", "Confirmation closes when the match starts.");
    return;
  }
  const confirmations = { ...schedule.confirmations, [seat]: true };
  await prisma.schedule.update({ where: { id: schedule.id }, data: { confirmations } });
  const row = confirmRow(schedule.id, schedule.judgeId, schedule.recorderId, confirmations.judge, confirmations.recorder);
  await interaction.update({ components: row ? [row] : [], allowedMentions: { parse: [] } });
  const ticket = await ticketChannel(guild, schedule.channelId);
  const label = seat === "judge" ? "Judge" : "Recorder";
  await ticket?.send({
    content: `${formatUser(interaction.user.id)} Attendance confirmed as ${label} for this match.`,
    allowedMentions: { users: [interaction.user.id], parse: [] },
  });
}
