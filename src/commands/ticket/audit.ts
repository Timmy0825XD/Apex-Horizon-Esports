import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatCategory } from "../../lib/formatters.js";

export async function auditValidationClose(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  tournamentName: string,
  channelId: string,
  transcriptChannelId: string,
): Promise<void> {
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.ticketSystem,
    description: `A group validation ticket for **${tournamentName}** was archived and deleted.`,
    details: [
      `**Tournament:** **${tournamentName}**`,
      `**Ticket:** ${formatChannel(guild, channelId)}`,
      `**Transcripts:** ${formatChannel(guild, transcriptChannelId)}`,
    ],
    actor: interaction.user,
  });
}

export async function auditTicket(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  action: "closed" | "reopened" | "deleted",
  channelId: string,
  tournamentName: string,
  matchId: number,
  categoryId?: string,
): Promise<void> {
  const verb = action === "closed" ? "closed" : action === "reopened" ? "reopened" : "deleted";
  const details = [
    `**Tournament:** **${tournamentName}**`,
    `**Match ID:** \`${matchId}\``,
    `**Ticket:** ${formatChannel(guild, channelId)}`,
  ];
  if (categoryId) {
    details.push(`**Category:** ${formatCategory(guild, categoryId)}`);
  }
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.ticketSystem,
    description: `Battle ticket for **${tournamentName}** was ${verb}.`,
    details,
    actor: interaction.user,
  });
}
