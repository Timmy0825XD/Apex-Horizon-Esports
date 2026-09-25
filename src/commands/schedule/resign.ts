import type { ChatInputCommandInteraction } from "discord.js";
import { escapeDiscord } from "../room/labels.js";
import { prisma } from "../../lib/prisma.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { revokeTicket } from "./channel.js";
import { paintSchedule } from "./live.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { seatResignedLine } from "./seat.js";
import type { TicketBundle } from "./ticket.js";

export async function runResign(interaction: ChatInputCommandInteraction, bundle: TicketBundle): Promise<void> {
  const guild = interaction.guild;
  const schedule = bundle.schedule;
  if (!guild || !schedule) {
    await replySchedule(interaction, scheduleNotice("error", "No schedule", "This ticket does not have a schedule."));
    return;
  }
  const userId = interaction.user.id;
  const holdsJudge = schedule.judgeId === userId;
  const holdsRecorder = schedule.recorderId === userId;
  if (!holdsJudge && !holdsRecorder) {
    await replySchedule(interaction, scheduleNotice("error", "Not assigned", "Only the judge or recorder on this schedule can resign."));
    return;
  }
  const role = interaction.options.getString("role");
  const dropJudge = role === "judge" || role === "both" || (role == null && holdsJudge);
  const dropRecorder = role === "recorder" || role === "both" || (role == null && holdsRecorder);
  if (role === "judge" && !holdsJudge) {
    await replySchedule(interaction, scheduleNotice("error", "Not the judge", "You are not the judge on this schedule."));
    return;
  }
  if (role === "recorder" && !holdsRecorder) {
    await replySchedule(interaction, scheduleNotice("error", "Not the recorder", "You are not the recorder on this schedule."));
    return;
  }
  if (role === "both" && !holdsJudge && !holdsRecorder) {
    await replySchedule(interaction, scheduleNotice("error", "Not assigned", "You do not hold both seats."));
    return;
  }
  let judgeId = schedule.judgeId;
  let recorderId = schedule.recorderId;
  const confirmations = { ...schedule.confirmations };
  if (dropJudge && holdsJudge) {
    judgeId = null;
    confirmations.judge = false;
  }
  if (dropRecorder && holdsRecorder) {
    recorderId = null;
    confirmations.recorder = false;
  }
  const stillSeated = judgeId === userId || recorderId === userId;
  await revokeTicket(bundle.channel, userId, stillSeated);
  const next = await prisma.schedule.update({
    where: { id: schedule.id },
    data: { judgeId, recorderId, confirmations },
  });
  const regenerate = interaction.options.getBoolean("regenerate_image") ?? false;
  await paintSchedule(guild, bundle.channel, bundle.settings, bundle.tournament, bundle.match, next, regenerate);
  const rawReason = interaction.options.getString("reason")?.trim() || null;
  const privateReason = rawReason === ".";
  const dropped: string[] = [];
  if (dropJudge && holdsJudge) {
    dropped.push(seatResignedLine("judge", userId));
  }
  if (dropRecorder && holdsRecorder) {
    dropped.push(seatResignedLine("recorder", userId));
  }
  if (rawReason && !privateReason) {
    dropped.push(`**Reason:** ${escapeDiscord(rawReason)}`);
  }
  await replySchedule(interaction, {
    content: dropped.join("\n"),
    allowedMentions: { users: [userId], parse: [] },
  });
  const details = [ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)];
  if (privateReason) {
    details.push("**Reason:** *private*");
  } else if (rawReason) {
    details.push(`**Reason:** ${rawReason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    description: `Staff resigned from a schedule in **${bundle.tournament.name}**.`,
    details,
  });
}
