import type { GuildSettings } from "@prisma/client";
import type { Guild, User } from "discord.js";
import { fact, publishAudit, type AuditAction } from "../../lib/audit.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { escapeDiscord } from "../room/labels.js";

type AuditInput = {
  guild: Guild;
  settings: GuildSettings | null;
  actor: User;
  action: AuditAction;
  title: string;
  summary: string;
  details: string[];
};

export async function auditAttendance(input: AuditInput): Promise<void> {
  if (!input.settings) {
    return;
  }
  await publishAudit({
    guild: input.guild,
    channelId: input.settings.botLogsChannelId,
    module: "attendance",
    action: input.action,
    title: input.title,
    summary: input.summary,
    groups: [{ lines: input.details }],
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
  const lines = [fact("Tournament", escapeDiscord(input.tournamentName))];
  if (input.channelId) {
    lines.push(fact("Ticket", formatChannel(null, input.channelId)));
  }
  const people = [
    input.judgeId ? fact("Judge", formatUser(input.judgeId)) : null,
    input.recorderId ? fact("Recorder", formatUser(input.recorderId)) : null,
  ].filter((line): line is string => Boolean(line));
  if (people.length > 0) {
    lines.push(people.join(" · "));
  }
  if (input.score) {
    lines.push(fact("Score", input.score));
  }
  if (input.extra) {
    lines.push(...input.extra);
  }
  return lines;
}
