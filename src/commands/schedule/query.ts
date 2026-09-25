import type { ChatInputCommandInteraction } from "discord.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { escapeDiscord } from "../room/labels.js";
import { loadGuildSettings } from "../settings/store.js";
import { loadGuildStaffState } from "../staff/store.js";
import { findTournamentById } from "../tournament/store.js";
import { isStaff } from "./access.js";
import { thumbnailImageUrl } from "./messages.js";
import { replySchedule, scheduleNotice } from "./respond.js";
import { presentFace } from "./store.js";
import { scheduleEmbed } from "./view.js";

export async function runShow(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild || !interaction.guildId) {
    return;
  }
  const { staff } = await loadGuildStaffState(guild.id);
  if (!staff || !isStaff(interaction, staff)) {
    await replySchedule(interaction, scheduleNotice("error", "Staff required", "Only members with the **staff** role can view a schedule."));
    return;
  }
  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    await replySchedule(interaction, scheduleNotice("error", "Settings missing", "Server settings are not configured yet."));
    return;
  }
  const tournamentId = interaction.options.getString("tournament", true);
  const matchRaw = interaction.options.getString("match", true);
  const matchId = Number(matchRaw);
  if (!Number.isInteger(matchId)) {
    await replySchedule(interaction, scheduleNotice("error", "Unknown match", "Pick a match from the list."));
    return;
  }
  const tournament = await findTournamentById(guild.id, tournamentId);
  const match = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId: matchId } },
  });
  const schedule = await prisma.schedule.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId: matchId } },
  });
  if (!tournament || tournament.guildId !== guild.id || !match || !schedule) {
    await replySchedule(interaction, scheduleNotice("error", "Schedule not found", "That match does not have a schedule in this server."));
    return;
  }
  const imageUrl = await thumbnailImageUrl(guild, settings.thumbnailChannelId, schedule.messages.thumbnailMessageId);
  const face = await presentFace(guild, tournament, match, schedule, imageUrl);
  await replySchedule(interaction, { embeds: [scheduleEmbed(face)] });
}

export async function runUnassigned(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  const { staff } = await loadGuildStaffState(guild.id);
  if (!staff || !isStaff(interaction, staff)) {
    await replySchedule(interaction, scheduleNotice("error", "Staff required", "Only members with the **staff** role can list open seats."));
    return;
  }
  const filter = interaction.options.getString("filter") ?? "any";
  const rows = await prisma.schedule.findMany({ where: { guildId: guild.id }, orderBy: { scheduledAt: "asc" } });
  const open = rows.filter((row) => {
    const missingJudge = !row.judgeId;
    const missingRecorder = !row.recorderId;
    if (filter === "all") {
      return missingJudge && missingRecorder;
    }
    if (filter === "missing_judge") {
      return missingJudge;
    }
    if (filter === "missing_recorder") {
      return missingRecorder;
    }
    return missingJudge || missingRecorder;
  });
  if (open.length === 0) {
    await replySchedule(interaction, scheduleNotice("info", "No open seats", "Every listed schedule already has the staff this filter asks for."));
    return;
  }
  const matches = await prisma.match.findMany({
    where: { tournamentId: { in: [...new Set(open.map((row) => row.tournamentId))] } },
  });
  const shown = open.slice(0, 15);
  const lines = shown.map((row) => {
    const match = matches.find((item) => item.tournamentId === row.tournamentId && item.challongeMatchId === row.challongeMatchId);
    const title = match ? `${escapeDiscord(match.player1Name)} vs ${escapeDiscord(match.player2Name)}` : `Match \`${row.challongeMatchId}\``;
    const judge = row.judgeId ? formatUser(row.judgeId) : "*open*";
    const recorder = row.recorderId ? formatUser(row.recorderId) : "*open*";
    return `${formatChannel(guild, row.channelId)} — **${title}**\nJudge ${judge} · Recorder ${recorder}`;
  });
  if (open.length > shown.length) {
    lines.push(`*And **${open.length - shown.length}** more.*`);
  }
  await replySchedule(interaction, scheduleNotice("info", "Unassigned schedules", lines.join("\n\n")));
}
