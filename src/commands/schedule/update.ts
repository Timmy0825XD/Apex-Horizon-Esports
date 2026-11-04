import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import { actorMatches } from "../../lib/command-access.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { isTournamentAdminOrHelper, memberHasRole } from "./access.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { isAtLeastTenMinutesAhead, utcFromParts, type ClockParts } from "./clock.js";
import { grantTicket, revokeTicket, ticketChannel } from "./channel.js";
import { deleteTracked } from "./messages.js";
import { paintSchedule } from "./live.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { closedSeatBody, closedSeatTitle, postSeatLine, seatAssignedLine, seatClashLine, seatResignedLine, seatsAreClosed, type Seat } from "./seat.js";
import { bookedAround, fullMinuteBody, fullMinuteTitle, minuteIsFull, staffBusyBody, staffBusyTitle, staffClash } from "./conflicts.js";
import { formatUser } from "../../lib/formatters.js";
import { slashMention } from "../../lib/register-slash.js";
import type { TicketBundle } from "./ticket.js";

interface FreedSeat {
  seat: Seat;
  userId: string;
}

function replacementBody(guildId: string, freed: FreedSeat[]): string {
  const lines = freed.map(
    (entry) =>
      `- ${formatUser(entry.userId)} left the **${entry.seat === "judge" ? "Judge" : "Recorder"}** seat: they have another match less than **30 minutes** from the new time.`,
  );
  return [...lines, `Assign someone else with ${slashMention(guildId, "schedule update")} or reopen the claim buttons with ${slashMention(guildId, "schedule refresh")}.`].join("\n");
}

function readClock(interaction: ChatInputCommandInteraction, current: Date): ClockParts | null {
  const hour = interaction.options.getInteger("hour");
  const minute = interaction.options.getInteger("minute");
  const day = interaction.options.getInteger("day");
  const month = interaction.options.getInteger("month");
  const year = interaction.options.getInteger("year");
  if (hour == null && minute == null && day == null && month == null && year == null) {
    return null;
  }
  return {
    hour: hour ?? current.getUTCHours(),
    minute: minute ?? current.getUTCMinutes(),
    day: day ?? current.getUTCDate(),
    month: month ?? current.getUTCMonth() + 1,
    year: year ?? current.getUTCFullYear(),
  };
}

export async function runUpdate(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule) {
    await replySchedule(interaction, scheduleNotice("error", "No schedule", "Create a schedule in this ticket first."));
    return;
  }
  if (!isTournamentAdminOrHelper(interaction, bundle.tournament) && !(await memberIsOrganiser(interaction))) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "error",
        "Tournament admin, helper, or organiser required",
        "Only that tournament's **admin** or **helper**, or an **Organiser**, can update a schedule.",
      ),
    );
    return;
  }
  const clock = readClock(interaction, schedule.scheduledAt);
  const judge = interaction.options.getUser("judge");
  const recorder = interaction.options.getUser("recorder");
  const note = interaction.options.getString("note");
  const removeJudge = interaction.options.getBoolean("remove_judge") ?? false;
  const removeRecorder = interaction.options.getBoolean("remove_recorder") ?? false;
  const reason = interaction.options.getString("reason")?.trim() || null;
  const regenerate = interaction.options.getBoolean("regenerate_image") ?? false;
  if (clock == null && !judge && !recorder && note == null && !removeJudge && !removeRecorder && !regenerate) {
    await replySchedule(interaction, scheduleNotice("error", "Nothing to change", "Pass at least one field."));
    return;
  }
  if (removeJudge && judge) {
    await replySchedule(interaction, scheduleNotice("error", "Judge conflict", "Assign a judge or clear the seat, not both."));
    return;
  }
  if (removeRecorder && recorder) {
    await replySchedule(interaction, scheduleNotice("error", "Recorder conflict", "Assign a recorder or clear the seat, not both."));
    return;
  }
  if ((judge || recorder) && !bundle.staff) {
    await replySchedule(interaction, scheduleNotice("error", "Staff not configured", "Staff roles are not configured yet."));
    return;
  }
  if (judge && bundle.staff && !(await memberHasRole(guild, judge.id, bundle.staff.judgeRoleId))) {
    await replySchedule(interaction, scheduleNotice("error", "Judge role required", "That user does not have the **judge** role."));
    return;
  }
  if (recorder && bundle.staff && !(await memberHasRole(guild, recorder.id, bundle.staff.recorderRoleId))) {
    await replySchedule(interaction, scheduleNotice("error", "Recorder role required", "That user does not have the **recorder** role."));
    return;
  }
  const assigningJudge = Boolean(judge && judge.id !== schedule.judgeId);
  const assigningRecorder = Boolean(recorder && recorder.id !== schedule.recorderId);
  if ((assigningJudge || assigningRecorder) && (await seatsAreClosed(schedule, bundle.room.status))) {
    await replySchedule(interaction, scheduleNotice("error", closedSeatTitle, closedSeatBody));
    return;
  }
  let scheduledAt = schedule.scheduledAt;
  let resetReminders = false;
  if (clock) {
    const when = utcFromParts(clock);
    if (!when) {
      await replySchedule(interaction, scheduleNotice("error", "Invalid UTC time", "That day does not exist on the calendar."));
      return;
    }
    if (when.getTime() <= Date.now()) {
      await replySchedule(interaction, scheduleNotice("error", "In the past", "That time is already in the past."));
      return;
    }
    if (!isAtLeastTenMinutesAhead(when)) {
      await replySchedule(interaction, scheduleNotice("error", "Too soon", "The new time must be at least **10 minutes** in the future."));
      return;
    }
    if (when.getTime() !== schedule.scheduledAt.getTime()) {
      scheduledAt = when;
      resetReminders = true;
    }
  }
  const incoming = [
    ...new Set([assigningJudge ? judge?.id : null, assigningRecorder ? recorder?.id : null].filter((id): id is string => Boolean(id))),
  ];
  const booked = resetReminders || incoming.length ? await bookedAround(guild.id, scheduledAt, schedule.id) : [];
  if (resetReminders && minuteIsFull(booked, scheduledAt)) {
    await replySchedule(interaction, scheduleNotice("error", fullMinuteTitle, fullMinuteBody(scheduledAt)));
    return;
  }
  for (const userId of incoming) {
    const clash = staffClash(booked, userId, scheduledAt);
    if (clash) {
      await replySchedule(interaction, scheduleNotice("error", staffBusyTitle, staffBusyBody(userId, clash)));
      return;
    }
  }
  // Staff who keep their seat but clash with another match at the new time lose that seat.
  const clashing = (seat: Seat, holder: string | null, removing: boolean, assigning: boolean): FreedSeat | null =>
    resetReminders && holder && !removing && !assigning && staffClash(booked, holder, scheduledAt) ? { seat, userId: holder } : null;
  const freed = [
    clashing("judge", schedule.judgeId, removeJudge, assigningJudge),
    clashing("recorder", schedule.recorderId, removeRecorder, assigningRecorder),
  ].filter((entry): entry is FreedSeat => entry !== null);
  const freedFrom = (seat: Seat) => freed.some((entry) => entry.seat === seat);
  const dropJudge = removeJudge || freedFrom("judge");
  const dropRecorder = removeRecorder || freedFrom("recorder");
  const previousJudge = schedule.judgeId;
  const previousRecorder = schedule.recorderId;
  let judgeId = previousJudge;
  let recorderId = previousRecorder;
  let confirmations = { ...schedule.confirmations };
  if (dropJudge && judgeId) {
    await revokeTicket(bundle.channel, judgeId, recorderId === judgeId && !dropRecorder);
    judgeId = null;
    confirmations.judge = false;
  }
  if (dropRecorder && recorderId) {
    await revokeTicket(bundle.channel, recorderId, judgeId === recorderId);
    recorderId = null;
    confirmations.recorder = false;
  }
  if (judge && judge.id !== judgeId) {
    if (judgeId) {
      await revokeTicket(bundle.channel, judgeId, judgeId === recorderId);
    }
    judgeId = judge.id;
    confirmations.judge = false;
    await grantTicket(bundle.channel, judgeId);
  }
  if (recorder && recorder.id !== recorderId) {
    if (recorderId) {
      await revokeTicket(bundle.channel, recorderId, recorderId === judgeId);
    }
    recorderId = recorder.id;
    confirmations.recorder = false;
    await grantTicket(bundle.channel, recorderId);
  }
  if (resetReminders) {
    await deleteTracked(guild, schedule.channelId, schedule.messages.t10MessageId);
    await deleteTracked(guild, bundle.settings.schedulesChannelId, schedule.messages.t0MessageId);
    confirmations = { judge: false, recorder: false };
  }
  const next = await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      scheduledAt,
      judgeId,
      recorderId,
      remark: note == null ? schedule.remark : note.trim() || null,
      confirmations,
      reminderPhase: resetReminders ? "pending" : schedule.reminderPhase,
      ...(resetReminders ? { alert: null } : {}),
      messages: resetReminders ? { ...schedule.messages, t10MessageId: null, t0MessageId: null } : schedule.messages,
    },
  });
  await paintSchedule(guild, bundle.channel, bundle.settings, bundle.tournament, bundle.match, next, regenerate || resetReminders, "staff");
  if (previousJudge && previousJudge !== judgeId) {
    const line = freedFrom("judge") ? seatClashLine("judge", previousJudge) : seatResignedLine("judge", previousJudge);
    await postSeatLine(bundle.channel, line, previousJudge);
  }
  if (judgeId && judgeId !== previousJudge) {
    await postSeatLine(bundle.channel, seatAssignedLine("judge", judgeId), judgeId);
  }
  if (previousRecorder && previousRecorder !== recorderId) {
    const line = freedFrom("recorder") ? seatClashLine("recorder", previousRecorder) : seatResignedLine("recorder", previousRecorder);
    await postSeatLine(bundle.channel, line, previousRecorder);
  }
  if (recorderId && recorderId !== previousRecorder) {
    await postSeatLine(bundle.channel, seatAssignedLine("recorder", recorderId), recorderId);
  }
  const updated = scheduleNotice("success", "Schedule updated", [ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)].join("\n"));
  if (freed.length) {
    const replacement = scheduleNotice("error", "Find a replacement", replacementBody(guild.id, freed));
    updated.components = [...(updated.components ?? []), ...(replacement.components ?? [])];
  }
  await replySchedule(interaction, updated);
  const details = [ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)];
  if (freed.length) {
    details.push(`**Removed for clash** ${freed.map((entry) => `${formatUser(entry.userId)} (${entry.seat})`).join(", ")}`);
  }
  if (reason) {
    details.push(`**Reason** ${reason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    action: "updated",
    title: "Schedule updated",
    summary: `A schedule was updated for **${bundle.tournament.name}**.`,
    details,
  });
}

export async function runRefresh(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild || !interaction.guildId) {
    return;
  }
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
  if (!(await actorMatches(interaction, { organiser: true, helper: true, staff: true, judge: true, recorder: true }))) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "error",
        "Schedule refresh restricted",
        "You need **Organiser**, a tournament **helper** role, or the **staff**, **judge**, or **recorder** role to refresh a schedule.",
      ),
    );
    return;
  }
  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    await replySchedule(interaction, scheduleNotice("error", "Settings missing", "Server settings are not configured yet."));
    return;
  }
  const scheduleId = interaction.options.getString("match", true);
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || schedule.guildId !== guild.id) {
    await replySchedule(interaction, scheduleNotice("error", "Schedule not found", "Pick a match from the list."));
    return;
  }
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await prisma.match.findUnique({
    where: {
      tournamentId_challongeMatchId: {
        tournamentId: schedule.tournamentId,
        challongeMatchId: schedule.challongeMatchId,
      },
    },
  });
  const ticket = await ticketChannel(guild, schedule.channelId);
  if (!tournament || !match || !ticket) {
    await replySchedule(interaction, scheduleNotice("error", "Schedule not found", "That match does not have a usable schedule in this server."));
    return;
  }
  if (schedule.scheduledAt.getTime() <= Date.now()) {
    await replySchedule(
      interaction,
      scheduleNotice("error", "Match already started", "Claim buttons stay closed once the scheduled time has passed."),
    );
    return;
  }
  if (await seatsAreClosed(schedule)) {
    await paintSchedule(guild, ticket, settings, tournament, match, schedule, false).catch((error) => {
      console.error("Schedule seat lock failed", error);
    });
    await replySchedule(interaction, scheduleNotice("error", closedSeatTitle, closedSeatBody));
    return;
  }
  const opened = await prisma.schedule.update({
    where: { id: schedule.id },
    data: { claimsOpenUntil: new Date(Date.now() + 10 * 60 * 1000) },
  });
  const painted = await paintSchedule(guild, ticket, settings, tournament, match, opened, false);
  const boardUrl = `https://discord.com/channels/${guild.id}/${settings.schedulesChannelId}/${painted.messages.scheduleChannelMessageId}`;
  await replySchedule(
    interaction,
    scheduleNotice(
      "info",
      "Schedule refreshed",
      `The posts and claim buttons were renewed. The time did not change.\n**Link:** ${boardUrl}`,
    ),
  );
  await auditSchedule({
    guild,
    settings,
    actor: interaction.user,
    action: "updated",
    title: "Schedule refreshed",
    summary: `The posts and claim buttons were renewed for **${tournament.name}**.`,
    details: [ticketLine(guild, ticket.id), `**Link** ${boardUrl}`],
  });
}
