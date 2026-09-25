import type { Client, Guild } from "discord.js";
import type { Schedule } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { formatChannel, formatUser } from "../lib/formatters.js";
import { loadGuildSettings } from "../commands/settings/store.js";
import { findTournamentById } from "../commands/tournament/store.js";
import { revokeTicket, ticketChannel } from "../commands/schedule/channel.js";
import { paintSchedule } from "../commands/schedule/live.js";
import { publishUrgent, thumbnailImageUrl } from "../commands/schedule/messages.js";
import { presentFace } from "../commands/schedule/store.js";
import { postSeatLine, seatResignedLine } from "../commands/schedule/seat.js";
import { confirmRow, reminderScheduleEmbed } from "../commands/schedule/view.js";

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
    for (const schedule of due) {
      const guild = await client.guilds.fetch(schedule.guildId).catch(() => null);
      if (!guild) {
        continue;
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
  } catch (error) {
    console.error("Schedule reminder sweep failed", error);
  } finally {
    running = false;
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
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
  if (!tournament || !match) {
    return;
  }
  const settings = await loadGuildSettings(guild.id);
  const imageUrl = settings
    ? await thumbnailImageUrl(guild, settings.thumbnailChannelId, schedule.messages.thumbnailMessageId)
    : undefined;
  const face = await presentFace(guild, tournament, match, schedule, imageUrl);
  const row = confirmRow(schedule.id, schedule.judgeId, schedule.recorderId, schedule.confirmations.judge, schedule.confirmations.recorder);
  const mentions = [...new Set([face.captain1Id, face.captain2Id, schedule.judgeId, schedule.recorderId].filter((id): id is string => Boolean(id)))];
  const rules = formatChannel(guild, tournament.rulesChannelId);
  const message = await ticket.send({
    content: `${mentions.map((id) => formatUser(id)).join(" ")}\nPlease make sure to read and follow the rules stated in ${rules}.`,
    embeds: [reminderScheduleEmbed(face)],
    components: row ? [row] : [],
    allowedMentions: { users: mentions, parse: [] },
  });
  await prisma.schedule.update({
    where: { id: schedule.id },
    data: { reminderPhase: "t10", messages: { ...schedule.messages, t10MessageId: message.id } },
  });
}

async function startTime(guild: Guild, schedule: Schedule): Promise<void> {
  const settings = await loadGuildSettings(guild.id);
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
  const ticket = await ticketChannel(guild, schedule.channelId);
  if (!settings || !tournament || !match || !ticket) {
    await prisma.schedule.update({ where: { id: schedule.id }, data: { reminderPhase: "t0" } });
    return;
  }
  const alert = alertFrom(schedule);
  let judgeId = schedule.judgeId;
  let recorderId = schedule.recorderId;
  if (judgeId && !schedule.confirmations.judge) {
    await revokeTicket(ticket, judgeId, recorderId === judgeId && schedule.confirmations.recorder);
    await postSeatLine(ticket, seatResignedLine("judge", judgeId), judgeId);
    judgeId = null;
  }
  if (recorderId && !schedule.confirmations.recorder) {
    await revokeTicket(ticket, recorderId, judgeId === recorderId);
    await postSeatLine(ticket, seatResignedLine("recorder", recorderId), recorderId);
    recorderId = null;
  }
  const needsUrgent = !judgeId || !recorderId;
  const claimsOpenUntil = needsUrgent ? new Date(Date.now() + 10 * 60 * 1000) : schedule.claimsOpenUntil;
  const next = await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      judgeId,
      recorderId,
      confirmations: { judge: Boolean(judgeId) && schedule.confirmations.judge, recorder: Boolean(recorderId) && schedule.confirmations.recorder },
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
  const alert = alertFrom(schedule);
  if (!alert) {
    return;
  }
  const settings = await loadGuildSettings(guild.id);
  const tournament = await findTournamentById(guild.id, schedule.tournamentId);
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: schedule.tournamentId, challongeMatchId: schedule.challongeMatchId } },
  });
  const ticket = await ticketChannel(guild, schedule.channelId);
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
