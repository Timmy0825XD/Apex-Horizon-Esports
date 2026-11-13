import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { emojis } from "../../emojis.js";
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

/** A click this soon after Assign turned on is faster than a person can react: it is blocked. */
export const FAST_CLAIM_MS = 700;

/** How fast the click came after Assign turned on. */
export function reactionLine(ms: number | null): string {
  return ms === null ? fact("Reaction", "*unknown*") : fact("Reaction", `\`${Math.max(0, ms)} ms\` after Assign turned on`);
}

/** Why a too-fast click was refused. */
export function fastLine(): string {
  return `${emojis.alert} **Fast click** · under \`${FAST_CLAIM_MS} ms\`, faster than a person reacts.`;
}

/** Until when the member cannot claim this schedule. */
export function blockLine(until: Date): string {
  const unix = Math.floor(until.getTime() / 1000);
  return fact("Blocked", `from this match until <t:${unix}:t> (<t:${unix}:R>)`);
}

/** When a blocked claim was pressed, relative to the unlock it did not wait for. */
export function earlyLine(clickedAt: number, unlockAt: Date | null): string {
  if (!unlockAt || unlockAt.getTime() - clickedAt > 60_000) {
    return fact("Pressed", "while Assign was still disabled");
  }
  return fact("Pressed", `\`${unlockAt.getTime() - clickedAt} ms\` before Assign turned on`);
}
