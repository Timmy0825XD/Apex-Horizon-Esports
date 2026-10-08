import type { GuildSettings } from "@prisma/client";
import type { Guild, User } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { escapeDiscord } from "../room/labels.js";

type AuditInput = {
  guild: Guild;
  settings: GuildSettings | null;
  actor: User;
  description: string;
  details: string[];
};

export async function auditAttendance(input: AuditInput): Promise<void> {
  if (!input.settings) {
    return;
  }
  await publishAudit({
    guild: input.guild,
    channelId: input.settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: input.description,
    details: input.details,
    actor: input.actor,
  });
}

export function attendanceAuditDetails(input: {
  tournamentName: string;
  channelId?: string;
  judgeId?: string;
  recorderId?: string;
  score?: string;
  extra?: string[];
}): string[] {
  const lines = [`**Tournament:** ${escapeDiscord(input.tournamentName)}`];
  if (input.channelId) {
    lines.push(`**Channel:** ${formatChannel(null, input.channelId)}`);
  }
  if (input.judgeId) {
    lines.push(`**Judge:** ${formatUser(input.judgeId)}`);
  }
  if (input.recorderId) {
    lines.push(`**Recorder:** ${formatUser(input.recorderId)}`);
  }
  if (input.score) {
    lines.push(`**Score:** ${input.score}`);
  }
  if (input.extra) {
    lines.push(...input.extra);
  }
  return lines;
}
