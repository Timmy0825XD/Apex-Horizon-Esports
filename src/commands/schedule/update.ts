import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { isStaff, isTournamentAdminOrHelper, memberHasRole } from "./access.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { isAtLeastTenMinutesAhead, utcFromParts, type ClockParts } from "./clock.js";
import { grantTicket, revokeTicket } from "./channel.js";
import { deleteTracked } from "./messages.js";
import { paintSchedule } from "./live.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { postSeatLine, seatAssignedLine, seatResignedLine } from "./seat.js";
import type { TicketBundle } from "./ticket.js";

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
  if (!isTournamentAdminOrHelper(interaction, bundle.tournament)) {
    await replySchedule(interaction, scheduleNotice("error", "Tournament admin or helper required", "Only that tournament's **admin** or **helper** can update a schedule."));
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
  const previousJudge = schedule.judgeId;
  const previousRecorder = schedule.recorderId;
  let judgeId = previousJudge;
  let recorderId = previousRecorder;
  let confirmations = { ...schedule.confirmations };
  if (removeJudge && judgeId) {
    await revokeTicket(bundle.channel, judgeId, recorderId === judgeId && !removeRecorder);
    judgeId = null;
    confirmations.judge = false;
  }
  if (removeRecorder && recorderId) {
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
  await paintSchedule(guild, bundle.channel, bundle.settings, bundle.tournament, bundle.match, next, regenerate || resetReminders);
  if (previousJudge && previousJudge !== judgeId) {
    await postSeatLine(bundle.channel, seatResignedLine("judge", previousJudge), previousJudge);
  }
  if (judgeId && judgeId !== previousJudge) {
    await postSeatLine(bundle.channel, seatAssignedLine("judge", judgeId), judgeId);
  }
  if (previousRecorder && previousRecorder !== recorderId) {
    await postSeatLine(bundle.channel, seatResignedLine("recorder", previousRecorder), previousRecorder);
  }
  if (recorderId && recorderId !== previousRecorder) {
    await postSeatLine(bundle.channel, seatAssignedLine("recorder", recorderId), recorderId);
  }
  await replySchedule(interaction, scheduleNotice("success", "Schedule updated", [ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)].join("\n")));
  const details = [ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)];
  if (reason) {
    details.push(`**Reason:** ${reason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: `A schedule was updated for **${bundle.tournament.name}**.`,
    details,
  });
}

export async function runRefresh(interaction: ChatInputCommandInteraction, bundle: TicketBundle, staff: NonNullable<TicketBundle["staff"]>): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule) {
    await replySchedule(interaction, scheduleNotice("error", "No schedule", "Create a schedule in this ticket first."));
    return;
  }
  if (!isStaff(interaction, staff)) {
    await replySchedule(interaction, scheduleNotice("error", "Staff required", "Only members with the **staff** role can refresh a schedule."));
    return;
  }
  const opened = await prisma.schedule.update({
    where: { id: schedule.id },
    data: { claimsOpenUntil: new Date(Date.now() + 10 * 60 * 1000) },
  });
  await paintSchedule(guild, bundle.channel, bundle.settings, bundle.tournament, bundle.match, opened, false);
  await replySchedule(interaction, scheduleNotice("info", "Schedule refreshed", "The posts and claim buttons were renewed. The time did not change."));
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: `A schedule post was refreshed for **${bundle.tournament.name}**.`,
    details: [ticketLine(guild, bundle.channel.id)],
  });
}
