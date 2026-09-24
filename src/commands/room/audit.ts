import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatChannel } from "../../lib/formatters.js";
import type { CreatedTicket } from "./open.js";

function ticketLines(guild: Guild, created: CreatedTicket[]): string[] {
  const shown = created.slice(0, 15).map((ticket) => formatChannel(guild, ticket.channelId));
  const extra = created.length - shown.length;
  if (extra > 0) {
    shown.push(`*And **${extra}** more.*`);
  }
  return shown;
}

export async function auditRoomsCreated(
  guild: Guild,
  settings: GuildSettings,
  actor: User,
  tournamentName: string,
  created: CreatedTicket[],
  failed: number,
): Promise<void> {
  if (created.length === 0) {
    return;
  }
  const details = [
    `**Tournament:** **${tournamentName}**`,
    `**Tickets created:** \`${created.length}\``,
    ...ticketLines(guild, created),
  ];
  if (failed > 0) {
    details.push(`**Not created:** \`${failed}\``);
  }
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description:
      created.length === 1
        ? `A battle ticket was created for **${tournamentName}**.`
        : `Battle tickets were created for **${tournamentName}**.`,
    details,
    actor,
  });
}

export async function auditAutoRoom(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  tournamentName: string,
  running: boolean,
  created: CreatedTicket[],
): Promise<void> {
  const details = [
    `**Tournament:** **${tournamentName}**`,
    `**Auto-room:** ${running ? "On" : "Off"}`,
  ];
  if (running) {
    details.push(`**Tickets created:** \`${created.length}\``);
    details.push(...ticketLines(guild, created));
  }
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: running
      ? `Auto-room was turned on for **${tournamentName}**.`
      : `Auto-room was turned off for **${tournamentName}**.`,
    details,
    actor: interaction.user,
  });
}
