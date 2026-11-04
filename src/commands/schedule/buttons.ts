import { ActionRowBuilder, ButtonBuilder, ContainerBuilder, MessageFlags, type ButtonInteraction, type Guild } from "discord.js";
import type { Schedule } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { formatUser } from "../../lib/formatters.js";
import { textBlock, v2Flags } from "../../lib/v2.js";
import { loadGuildSettings } from "../settings/store.js";
import { loadGuildStaffState } from "../staff/store.js";
import { findTournamentById } from "../tournament/store.js";
import { isJudge, isRecorder } from "./access.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { grantTicket, ticketChannel } from "./channel.js";
import { paintSchedule } from "./live.js";
import { bookedAround, selfBusyBody, staffBusyTitle, staffClash } from "./conflicts.js";
import {
  channelUrl,
  linkButton,
  matchEyebrow,
  matchName,
  scheduleCard,
  seatName,
  shortUtc,
  toneColor,
  type CardTone,
} from "./respond.js";
import { closedSeatBody, closedSeatTitle, postSeatLine, seatAssignedLine, seatHeldBy, seatsAreClosed, seatWrite } from "./seat.js";
import { handleOpenButton } from "./query.js";
import { handleShowButton } from "./show.js";
import { presentFace } from "./store.js";
import { claimsAreOpen, confirmRow, parseScheduleButton, reminderMentions, reminderPayload } from "./view.js";

/** Private V2 answer to whoever pressed. */
function privateReply(interaction: ButtonInteraction, tone: CardTone, title: string, body: string, extra?: ActionRowBuilder<ButtonBuilder>) {
  const card = scheduleCard({ tone, title, blocks: extra ? [body, extra] : [body] });
  const payload = { components: [card], allowedMentions: { parse: [] as const } };
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ ...payload, flags: v2Flags });
  }
  return interaction.reply({ ...payload, flags: [...v2Flags, MessageFlags.Ephemeral] });
}

function loadMatch(schedule: Schedule) {
  return prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
}

export async function handleScheduleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId.startsWith("schedule:show:")) {
    await handleShowButton(interaction);
    return;
  }
  if (interaction.customId.startsWith("schedule:open:")) {
    await handleOpenButton(interaction);
    return;
  }
  const parsed = parseScheduleButton(interaction.customId);
  const guild = interaction.guild;
  if (!parsed || !guild) {
    return;
  }
  const schedule = await prisma.schedule.findUnique({ where: { id: parsed.scheduleId } });
  if (!schedule || schedule.guildId !== guild.id) {
    await privateReply(interaction, "error", "Schedule missing", "That schedule was deleted, so its buttons no longer work.");
    return;
  }
  if (parsed.action === "claim") {
    await claimSeat(interaction, guild, schedule, parsed.seat);
    return;
  }
  await confirmSeat(interaction, guild, schedule, parsed.seat);
}

async function claimSeat(interaction: ButtonInteraction, guild: Guild, schedule: Schedule, seat: "judge" | "recorder"): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { staff } = await loadGuildStaffState(guild.id);
  const settings = await loadGuildSettings(guild.id);
  if (!staff || !settings) {
    await privateReply(interaction, "error", "Staff not configured", "Staff roles are not configured yet, so nobody can take a seat.");
    return;
  }
  const allowed = seat === "judge" ? isJudge(interaction, staff) : isRecorder(interaction, staff);
  if (!allowed) {
    await privateReply(
      interaction,
      "warning",
      `${seatName(seat)} role required`,
      `The **${seatName(seat)}** seat is only for members who hold that role.`,
    );
    return;
  }
  if (await seatsAreClosed(schedule)) {
    await privateReply(interaction, "warning", closedSeatTitle, closedSeatBody);
    const tournament = await findTournamentById(guild.id, schedule.tournamentId);
    const match = await loadMatch(schedule);
    const ticket = await ticketChannel(guild, schedule.channelId);
    if (tournament && match && ticket) {
      await paintSchedule(guild, ticket, settings, tournament, match, schedule, false).catch((error) => {
        console.error("Schedule seat lock failed", error);
      });
    }
    return;
  }
  if (!claimsAreOpen(schedule.claimsOpenUntil)) {
    await privateReply(interaction, "warning", "Buttons locked", "The claim window closed. A judge or recorder can run refresh to open it for 10 more minutes.");
    return;
  }
  const holder = seat === "judge" ? schedule.judgeId : schedule.recorderId;
  if (holder) {
    await privateReply(interaction, "warning", "Seat taken", `${formatUser(holder)} already holds the **${seatName(seat)}** seat.`);
    return;
  }
  const clash = staffClash(await bookedAround(guild.id, schedule.scheduledAt, schedule.id), interaction.user.id, schedule.scheduledAt);
  if (clash) {
    await privateReply(interaction, "warning", staffBusyTitle, selfBusyBody(clash));
    return;
  }
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await loadMatch(schedule);
  const ticket = await ticketChannel(guild, schedule.channelId);
  if (!tournament || !match || !ticket) {
    await privateReply(interaction, "error", "Ticket missing", "The battle ticket for this schedule could not be opened.");
    return;
  }
  // Reserve the seat only if it is still empty: two members pressing at once must not both win.
  const reserved = await prisma.schedule.updateMany({
    where: { id: schedule.id, ...seatHeldBy(seat, null) },
    data: seatWrite(seat, interaction.user.id, false),
  });
  if (reserved.count === 0) {
    const winner = await prisma.schedule.findUnique({ where: { id: schedule.id }, select: { judgeId: true, recorderId: true } });
    const taken = seat === "judge" ? winner?.judgeId : winner?.recorderId;
    await privateReply(
      interaction,
      "warning",
      "Seat taken",
      taken
        ? `${formatUser(taken)} took the **${seatName(seat)}** seat a moment before you.`
        : `Someone took the **${seatName(seat)}** seat a moment before you.`,
    );
    return;
  }
  try {
    await grantTicket(ticket, interaction.user.id);
  } catch (error) {
    console.error("Schedule seat grant failed", error);
    await prisma.schedule.updateMany({
      where: { id: schedule.id, ...seatHeldBy(seat, interaction.user.id) },
      data: seatWrite(seat, null, false),
    });
    await privateReply(interaction, "error", "Ticket access failed", "I could not add you to the battle ticket, so the seat was released.");
    return;
  }
  const next = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
  await paintSchedule(guild, ticket, settings, tournament, match, next, false);
  await postSeatLine(ticket, seatAssignedLine(seat, interaction.user.id), interaction.user.id);
  await interaction.editReply({
    components: [
      scheduleCard({
        tone: "success",
        eyebrow: matchEyebrow(tournament.name, match),
        title: "Seat claimed",
        blocks: [
          `You are the **${seatName(seat)}** for ${matchName(match.player1Name, match.player2Name)} · \`${shortUtc(schedule.scheduledAt)}\`.`,
          new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton("Open ticket", channelUrl(guild.id, ticket.id))),
        ],
      }),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
  await auditSchedule({
    guild,
    settings,
    actor: interaction.user,
    action: "updated",
    title: "Seat claimed",
    summary: `A ${seat} took a seat in **${tournament.name}**.`,
    details: [ticketLine(guild, ticket.id), peopleLine(next.judgeId, next.recorderId)],
  });
}

async function confirmSeat(interaction: ButtonInteraction, guild: Guild, schedule: Schedule, seat: "judge" | "recorder"): Promise<void> {
  const holder = seat === "judge" ? schedule.judgeId : schedule.recorderId;
  if (holder !== interaction.user.id) {
    await privateReply(interaction, "warning", "Not your seat", `Only the assigned **${seatName(seat)}** can confirm this seat.`);
    return;
  }
  if (Date.now() >= schedule.scheduledAt.getTime()) {
    await privateReply(interaction, "warning", "Match started", "Confirmation closes when the match starts.");
    return;
  }
  // Only flip this seat, and only while the presser still holds it.
  const confirmed = await prisma.schedule.updateMany({
    where: { id: schedule.id, ...seatHeldBy(seat, interaction.user.id) },
    data: { confirmations: { update: seat === "judge" ? { judge: true } : { recorder: true } } },
  });
  if (confirmed.count === 0) {
    await privateReply(interaction, "warning", "Not your seat", `Only the assigned **${seatName(seat)}** can confirm this seat.`);
    return;
  }
  const current = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
  await repaintReminder(interaction, guild, current);
  const ticket = await ticketChannel(guild, schedule.channelId);
  const minutes = Math.max(0, Math.round((schedule.scheduledAt.getTime() - Date.now()) / 60_000));
  await ticket?.send({
    components: [
      new ContainerBuilder()
        .setAccentColor(toneColor.success)
        .addTextDisplayComponents(
          textBlock(`${formatUser(interaction.user.id)} confirmed attendance as **${seatName(seat)}**.\n-# ${minutes} min before start`),
        ),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
}

/** Rebuild the T-10 card so its staff check shows the new state; reminders from before V2 only swap their buttons. */
async function repaintReminder(interaction: ButtonInteraction, guild: Guild, schedule: Schedule): Promise<void> {
  const row = confirmRow(schedule.id, schedule.judgeId, schedule.recorderId, schedule.confirmations.judge, schedule.confirmations.recorder);
  if (!interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
    await interaction.update({ components: row ? [row] : [], allowedMentions: { parse: [] } });
    return;
  }
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await loadMatch(schedule);
  if (!tournament || !match) {
    await interaction.deferUpdate();
    return;
  }
  const face = await presentFace(guild, tournament, match, schedule);
  await interaction.update({
    ...reminderPayload({
      face,
      scheduleId: schedule.id,
      confirmations: schedule.confirmations,
      rulesChannelId: tournament.rulesChannelId,
      mentionIds: reminderMentions(face, schedule),
    }),
    allowedMentions: { parse: [] },
  });
}
