import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { fact, publishAudit, type AuditAction } from "../../lib/audit.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";

type AuditInput = {
  guild: Guild;
  settings: GuildSettings;
  actor: User;
  action: AuditAction;
  title: string;
  summary: string;
  details: string[];
};

export async function auditSchedule(input: AuditInput): Promise<boolean> {
  return publishAudit({
    guild: input.guild,
    channelId: input.settings.botLogsChannelId,
    module: "schedules",
    action: input.action,
    title: input.title,
    summary: input.summary,
    groups: [{ lines: input.details }],
    actor: input.actor,
  });
}

export function actorOf(interaction: ChatInputCommandInteraction): User {
  return interaction.user;
}

export function peopleLine(judgeId: string | null, recorderId: string | null): string {
  const judge = judgeId ? formatUser(judgeId) : "*Unassigned*";
  const recorder = recorderId ? formatUser(recorderId) : "*Unassigned*";
  return `${fact("Judge", judge)} · ${fact("Recorder", recorder)}`;
}

export function ticketLine(guild: Guild, channelId: string): string {
  return fact("Ticket", formatChannel(guild, channelId));
}
