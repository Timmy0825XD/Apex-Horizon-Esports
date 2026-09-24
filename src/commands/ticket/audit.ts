import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel, formatCategory } from "../../lib/formatters.js";

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
