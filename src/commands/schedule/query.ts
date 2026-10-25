import type { ChatInputCommandInteraction } from "discord.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { escapeDiscord } from "../room/labels.js";
import { actorMatches } from "../../lib/command-access.js";
import { replySchedule, scheduleNotice } from "./respond.js";

export async function runUnassigned(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    return;
  }
  if (!(await actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true }))) {
    await replySchedule(
      interaction,
      scheduleNotice(
        "error",
        "Schedule access required",
        "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to list open seats.",
      ),
    );
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
