import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { removeAttendanceRows } from "../attendance/delete.js";
import { listActiveAttendance } from "../attendance/store.js";
import { memberIsOrganiser } from "../../lib/organiser.js";
import { isTournamentAdminOrHelper } from "./access.js";
import { auditSchedule, ticketLine } from "./audit.js";
import { revokeTicket, ticketChannel, unmarkTicket } from "./channel.js";
import { deleteScheduleEvent } from "./event.js";
import { clearScheduleMessages, deleteTracked } from "./messages.js";
import { slashMention } from "../../lib/register-slash.js";
import { cardPayload, matchEyebrow, matchName, quote, replySchedule, scheduleCard, scheduleNotice, shortUtc, stampFooter } from "./respond.js";
import type { TicketBundle } from "./ticket.js";

export async function runDelete(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule) {
    await replySchedule(interaction, scheduleNotice("error", "No schedule", "This ticket does not have a schedule."));
    return;
  }
  if (!isTournamentAdminOrHelper(interaction, bundle.tournament) && !(await memberIsOrganiser(interaction))) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "error",
        "Tournament admin, helper, or organiser required",
        "Only that tournament's **admin** or **helper**, or an **Organiser**, can delete a schedule.",
      ),
    );
    return;
  }
  if (!interaction.options.getBoolean("confirm", true)) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "info",
        "Delete cancelled",
        `The schedule for ${matchName(bundle.match.player1Name, bundle.match.player2Name)} is still active. Nothing was removed.`,
      ),
    );
    return;
  }
  const reason = interaction.options.getString("reason")?.trim() || null;
  await deleteScheduleEvent(guild, schedule.eventId);
  await clearScheduleMessages(guild, schedule, bundle.settings.schedulesChannelId, bundle.settings.thumbnailChannelId);
  if (schedule.results) {
    await deleteTracked(guild, schedule.channelId, schedule.results.ticketMessageId);
    await deleteTracked(guild, bundle.tournament.resultChannelId, schedule.results.messageId);
  }
  const ticket = await ticketChannel(guild, schedule.channelId);
  // Results and attendance belong to the schedule: deleting it leaves neither behind.
  const attendance = await listActiveAttendance(guild.id, bundle.tournament.id, schedule.challongeMatchId);
  await removeAttendanceRows(
    guild,
    ticket,
    bundle.tournament.attendanceChannelId,
    attendance,
    reason ? `Schedule deleted: ${reason}` : "Schedule deleted",
  );
  if (ticket) {
    if (schedule.judgeId) {
      await revokeTicket(ticket, schedule.judgeId, false);
    }
    if (schedule.recorderId && schedule.recorderId !== schedule.judgeId) {
      await revokeTicket(ticket, schedule.recorderId, false);
    }
    await unmarkTicket(ticket);
  }
  await prisma.schedule.delete({ where: { id: schedule.id } });
  const blocks = [
    `${matchName(bundle.match.player1Name, bundle.match.player2Name)} · was \`${shortUtc(schedule.scheduledAt)}\``,
    `Removed the ticket post, the schedules post, the thumbnail, the reminders${schedule.results ? ", the result" : ""}${attendance.length > 0 ? ", the attendance" : ""}, the server event and the live mark on the channel name.`,
  ];
  if (reason) {
    blocks.push(quote(reason));
  }
  blocks.push(`-# This cannot be undone. Run ${slashMention(guild.id, "schedule create")} to schedule the match again.`);
  await replySchedule(
    interaction,
    cardPayload(
      scheduleCard({
        tone: "danger",
        eyebrow: matchEyebrow(bundle.tournament.name, bundle.match),
        title: "Schedule deleted",
        blocks,
        footer: stampFooter("Deleted", interaction.user.id),
      }),
    ),
  );
  const details = [ticketLine(guild, schedule.channelId), `**Match** \`${schedule.challongeMatchId}\``];
  if (schedule.results) {
    details.push(`**Result removed** \`${schedule.results.team1Score} - ${schedule.results.team2Score}\``);
  }
  if (attendance.length > 0) {
    details.push("**Attendance removed** Yes");
  }
  if (reason) {
    details.push(`**Reason** ${reason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    action: "deleted",
    title: "Schedule deleted",
    summary: `A schedule was deleted for **${bundle.tournament.name}**.`,
    details,
  });
}
