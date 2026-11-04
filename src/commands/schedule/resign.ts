import type { ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { formatUser } from "../../lib/formatters.js";
import { slashMention } from "../../lib/register-slash.js";
import { prisma } from "../../lib/prisma.js";
import { auditSchedule, peopleLine, ticketLine } from "./audit.js";
import { revokeTicket } from "./channel.js";
import { paintSchedule } from "./live.js";
import { cardPayload, matchEyebrow, matchName, quote, replySchedule, scheduleCard, scheduleNotice, stampFooter } from "./respond.js";
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
  const seats = [dropJudge && holdsJudge ? "**Judge**" : null, dropRecorder && holdsRecorder ? "**Recorder**" : null].filter(Boolean);
  const blocks = [
    `${formatUser(userId)} left the ${seats.join(" and ")} seat${seats.length > 1 ? "s" : ""} for ${matchName(bundle.match.player1Name, bundle.match.player2Name)}.`,
  ];
  if (rawReason && !privateReason) {
    blocks.push(quote(rawReason));
  }
  blocks.push(`-# ${seats.length > 1 ? "Both seats are" : "The seat is"} open again and show${seats.length > 1 ? "" : "s"} up in ${slashMention(guild.id, "schedule unassigned")}.`);
  await replySchedule(
    interaction,
    cardPayload(
      scheduleCard({
        tone: "warning",
        emoji: emojis.resign,
        eyebrow: matchEyebrow(bundle.tournament.name, bundle.match),
        title: "Seat released",
        blocks,
        footer: stampFooter(null),
      }),
      [userId],
    ),
  );
  const details = [ticketLine(guild, bundle.channel.id), peopleLine(judgeId, recorderId)];
  if (privateReason) {
    details.push("**Reason** *private*");
  } else if (rawReason) {
    details.push(`**Reason** ${rawReason}`);
  }
  await auditSchedule({
    guild,
    settings: bundle.settings,
    actor: interaction.user,
    action: "updated",
    title: "Seat released",
    summary: `Staff resigned from a schedule in **${bundle.tournament.name}**.`,
    details,
  });
}
