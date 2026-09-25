import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";

type AuditInput = {
  guild: Guild;
  settings: GuildSettings;
  actor: User;
  description: string;
  details: string[];
};

export async function auditSchedule(input: AuditInput): Promise<void> {
  await publishAudit({
    guild: input.guild,
    channelId: input.settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: input.description,
    details: input.details,
    actor: input.actor,
  });
}

export function actorOf(interaction: ChatInputCommandInteraction): User {
  return interaction.user;
}

export function peopleLine(judgeId: string | null, recorderId: string | null): string {
  const judge = judgeId ? formatUser(judgeId) : "*Unassigned*";
  const recorder = recorderId ? formatUser(recorderId) : "*Unassigned*";
  return `**Judge:** ${judge}\n**Recorder:** ${recorder}`;
}

export function ticketLine(guild: Guild, channelId: string): string {
  return `**Ticket:** ${formatChannel(guild, channelId)}`;
}
