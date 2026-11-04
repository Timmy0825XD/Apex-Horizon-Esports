import type { Client, Guild } from "discord.js";
import type { Schedule } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { loadGuildSettings } from "../commands/settings/store.js";
import { findTournamentById } from "../commands/tournament/store.js";
import { revokeTicket, ticketChannel } from "../commands/schedule/channel.js";
import { paintSchedule } from "../commands/schedule/live.js";
import { publishUrgent, thumbnailImageUrl } from "../commands/schedule/messages.js";
import { presentFace } from "../commands/schedule/store.js";
import { postSeatLine, seatHeldBy, seatResignedLine, seatsAreClosed, seatWrite, type Seat } from "../commands/schedule/seat.js";
import { reminderMentions, reminderPayload } from "../commands/schedule/view.js";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startScheduleWorker(client: Client): void {
  if (timer) {
    return;
  }
  const tick = () => {
    void sweep(client);
  };
  timer = setInterval(tick, 60_000);
  tick();
}

export function stopScheduleWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function sweep(client: Client): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 10 * 60 * 1000);
    const due = await prisma.schedule.findMany({
      where: { reminderPhase: { in: ["pending", "t10"] }, scheduledAt: { lte: horizon } },
    });
    // A few schedules at a time; each one keeps its own steps in order.
    const queue = [...due];
    const lanes = Array.from({ length: Math.min(SWEEP_LANES, queue.length) }, async () => {
      for (let schedule = queue.shift(); schedule; schedule = queue.shift()) {
        await tickSchedule(client, now, schedule).catch((error) => {
          console.error(`Schedule reminder failed for ${schedule.id}`, error);
        });
      }
    });
    await Promise.all(lanes);
  } catch (error) {
    console.error("Schedule reminder sweep failed", error);
  } finally {
    running = false;
  }
}

const SWEEP_LANES = 4;

async function tickSchedule(client: Client, now: Date, schedule: Schedule): Promise<void> {
  // With the Guilds intent the cache lists every server the bot is in (outages stay cached as unavailable).
  // A miss means the bot left: retire the schedule instead of asking the API again every minute.
  const guild = client.guilds.cache.get(schedule.guildId);
  if (!guild) {
    await prisma.schedule.update({ where: { id: schedule.id }, data: { reminderPhase: "t0" } });
    return;
  }
  if (!guild.available) {
    return;
  }
  if (schedule.reminderPhase === "pending" && now < schedule.scheduledAt) {
    await sendReminder(guild, schedule);
  }
  const alertAt = schedule.scheduledAt.getTime() - 2 * 60 * 1000;
  if (now.getTime() >= alertAt && now < schedule.scheduledAt && !schedule.messages.t0MessageId) {
    await raiseStaffAlert(guild, schedule);
  }
  if (now >= schedule.scheduledAt && schedule.reminderPhase !== "t0") {
    await startTime(guild, schedule);
  }
}

async function sendReminder(guild: Guild, schedule: Schedule): Promise<void> {
  if (!schedule.judgeId && !schedule.recorderId) {
    return;
  }
  const ticket = await ticketChannel(guild, schedule.channelId);
  if (!ticket || schedule.messages.t10MessageId) {
    return;
  }
  const { tournament, match } = await loadScheduleContext(guild, schedule);
  if (!tournament || !match) {
    return;
  }
  const face = await presentFace(guild, tournament, match, schedule);
  const mentions = reminderMentions(face, schedule);
  const message = await ticket.send({
    ...reminderPayload({
      face,
      scheduleId: schedule.id,
      confirmations: schedule.confirmations,
      rulesChannelId: tournament.rulesChannelId,
      mentionIds: mentions,
    }),
    allowedMentions: { users: mentions, parse: [] },
  });
  await prisma.schedule.update({
    where: { id: schedule.id },
    data: { reminderPhase: "t10", messages: { ...schedule.messages, t10MessageId: message.id } },
  });
}

/** Release a seat only if that same member still holds it unconfirmed, so a fresh claim is never wiped. */
async function releaseUnconfirmed(scheduleId: string, seat: Seat, userId: string | null): Promise<boolean> {
  if (!userId) {
    return false;
  }
  const released = await prisma.schedule.updateMany({
    where: {
      id: scheduleId,
      ...seatHeldBy(seat, userId),
      confirmations: { is: seat === "judge" ? { judge: false } : { recorder: false } },
    },
    data: seatWrite(seat, null, false),
  });
  return released.count === 1;
}

async function startTime(guild: Guild, schedule: Schedule): Promise<void> {
  const { settings, tournament, match, ticket } = await loadScheduleContext(guild, schedule);
  if (!settings || !tournament || !match || !ticket) {
    await prisma.schedule.update({ where: { id: schedule.id }, data: { reminderPhase: "t0" } });
    return;
  }
  const closed = await seatsAreClosed(schedule);
  const alert = alertFrom(schedule);
  const judgeLeft = (await releaseUnconfirmed(schedule.id, "judge", schedule.judgeId)) ? schedule.judgeId : null;
  const recorderLeft = (await releaseUnconfirmed(schedule.id, "recorder", schedule.recorderId)) ? schedule.recorderId : null;
  const seated = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
  const stillSeated = (userId: string) => seated.judgeId === userId || seated.recorderId === userId;
  if (judgeLeft) {
    await revokeTicket(ticket, judgeLeft, stillSeated(judgeLeft));
    await postSeatLine(ticket, seatResignedLine("judge", judgeLeft), judgeLeft, "warning");
  }
  if (recorderLeft) {
    await revokeTicket(ticket, recorderLeft, stillSeated(recorderLeft));
    await postSeatLine(ticket, seatResignedLine("recorder", recorderLeft), recorderLeft, "warning");
  }
  const needsUrgent = !closed && (!seated.judgeId || !seated.recorderId);
  const claimsOpenUntil = needsUrgent ? new Date(Date.now() + 10 * 60 * 1000) : closed ? null : seated.claimsOpenUntil;
  // Seats are settled above; this write only moves the phase and the urgent window.
  const next = await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      reminderPhase: "t0",
      claimsOpenUntil,
      ...(alert && needsUrgent ? { alert } : {}),
    },
  });
  const painted = await paintSchedule(guild, ticket, settings, tournament, match, next, false);
  if (!needsUrgent || !alert || painted.messages.t0MessageId) {
    return;
  }
  const imageUrl = await thumbnailImageUrl(guild, settings.thumbnailChannelId, painted.messages.thumbnailMessageId);
  const face = await presentFace(guild, tournament, match, painted, imageUrl);
  const t0MessageId = await publishUrgent(guild, settings.schedulesChannelId, painted.id, face);
  await prisma.schedule.update({
    where: { id: painted.id },
    data: { messages: { ...painted.messages, t0MessageId } },
  });
}

async function raiseStaffAlert(guild: Guild, schedule: Schedule): Promise<void> {
  if (await seatsAreClosed(schedule)) {
    return;
  }
  const alert = alertFrom(schedule);
  if (!alert) {
    return;
  }
  const { settings, tournament, match, ticket } = await loadScheduleContext(guild, schedule);
  if (!settings || !tournament || !match || !ticket) {
    return;
  }
  const next = await prisma.schedule.update({
    where: { id: schedule.id },
    data: { alert, claimsOpenUntil: new Date(Date.now() + 10 * 60 * 1000) },
  });
  const painted = await paintSchedule(guild, ticket, settings, tournament, match, next, false);
  const imageUrl = await thumbnailImageUrl(guild, settings.thumbnailChannelId, painted.messages.thumbnailMessageId);
  const face = await presentFace(guild, tournament, match, painted, imageUrl);
  const t0MessageId = await publishUrgent(guild, settings.schedulesChannelId, painted.id, face);
  await prisma.schedule.update({
    where: { id: painted.id },
    data: { messages: { ...painted.messages, t0MessageId } },
  });
}

async function loadScheduleContext(guild: Guild, schedule: Schedule) {
  const [settings, tournament, match, ticket] = await Promise.all([
    loadGuildSettings(guild.id),
    findTournamentById(guild.id, schedule.tournamentId),
    prisma.match.findUnique({
      where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
    }),
    ticketChannel(guild, schedule.channelId),
  ]);
  return { settings, tournament, match, ticket };
}

function alertFrom(schedule: Schedule): Schedule["alert"] {
  const judgeMissing = !schedule.judgeId || !schedule.confirmations.judge;
  const recorderMissing = !schedule.recorderId || !schedule.confirmations.recorder;
  if (!judgeMissing && !recorderMissing) {
    return null;
  }
  return {
    raisedAt: new Date(),
    judgeFailedId: judgeMissing && schedule.judgeId ? schedule.judgeId : null,
    judgeVacant: judgeMissing && !schedule.judgeId,
    recorderFailedId: recorderMissing && schedule.recorderId ? schedule.recorderId : null,
    recorderVacant: recorderMissing && !schedule.recorderId,
  };
}
