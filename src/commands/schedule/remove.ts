import type { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { isTournamentAdminOrHelper } from "./access.js";
import { auditSchedule, ticketLine } from "./audit.js";
import { revokeTicket, ticketChannel, unmarkTicket } from "./channel.js";
import { deleteScheduleEvent } from "./event.js";
import { clearScheduleMessages, deleteTracked } from "./messages.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import type { TicketBundle } from "./ticket.js";

export async function runDelete(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule) {
    await replySchedule(interaction, scheduleNotice("error", "No schedule", "This ticket does not have a schedule."));
    return;
  }
  if (!isTournamentAdminOrHelper(interaction, bundle.tournament)) {
    await replySchedule(interaction, scheduleNotice("error", "Tournament admin or helper required", "Only that tournament's **admin** or **helper** can delete a schedule."));
    return;
  }
  if (!interaction.options.getBoolean("confirm", true)) {
    await replySchedule(interaction, scheduleNotice("info", "Delete cancelled", "The schedule is still active."));
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
  await replySchedule(interaction, scheduleNotice("success", "Schedule deleted", "The posts, reminders, and the live mark were removed. This cannot be undone."));
  const details = [ticketLine(guild, schedule.channelId), `**Match:** \`${schedule.challongeMatchId}\``];
  if (reason) {
    details.push(`**Reason:** ${reason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: `A schedule was deleted for **${bundle.tournament.name}**.`,
    details,
  });
}
