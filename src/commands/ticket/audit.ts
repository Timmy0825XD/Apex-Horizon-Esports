import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { fact, publishAudit } from "../../lib/audit.js";
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
    module: "ticketSystem",
    action: "deleted",
    title: "Validation ticket closed",
    summary: `A group validation ticket for **${tournamentName}** was archived and deleted.`,
    groups: [
      {
        lines: [
          fact("Ticket", formatChannel(guild, channelId)),
          fact("Transcript in", formatChannel(guild, transcriptChannelId)),
        ],
      },
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
  const details = [
    `${fact("Ticket", formatChannel(guild, channelId))} · ${fact("Match ID", `\`${matchId}\``)}`,
  ];
  if (categoryId) {
    details.push(fact(action === "reopened" ? "Moved back to" : "Moved to", formatCategory(guild, categoryId)));
  }
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "ticketSystem",
    action: action === "deleted" ? "deleted" : "updated",
    title: action === "closed" ? "Ticket closed" : action === "reopened" ? "Ticket reopened" : "Ticket deleted",
    summary: `A battle ticket in **${tournamentName}** was ${action}.`,
    groups: [{ lines: details }],
    actor: interaction.user,
  });
}
