import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, User } from "discord.js";
import { fact, listWithOverflow, publishAudit } from "../../lib/audit.js";
import { formatChannel } from "../../lib/formatters.js";
import type { CreatedTicket } from "./open.js";

function ticketLines(guild: Guild, created: CreatedTicket[]): string[] {
  return listWithOverflow(created.map((ticket) => formatChannel(guild, ticket.channelId)));
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
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "rooms",
    action: "created",
    title: created.length === 1 ? "Battle ticket opened" : "Battle tickets opened",
    summary:
      created.length === 1
        ? `A battle ticket was opened for **${tournamentName}**.`
        : `\`${created.length}\` battle tickets were opened for **${tournamentName}**.`,
    groups: [
      { label: `Tickets opened · ${created.length}`, lines: ticketLines(guild, created), inline: true },
      ...(failed > 0 ? [{ lines: [fact("Not opened", `\`${failed}\``)] }] : []),
    ],
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
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "rooms",
    action: "updated",
    title: running ? "Auto-room turned on" : "Auto-room turned off",
    summary: running
      ? `**${tournamentName}** opens battle tickets at 00:00 and 12:00 UTC.`
      : `**${tournamentName}** stopped opening battle tickets on its own.`,
    groups:
      running && created.length > 0
        ? [{ label: `Tickets opened now · ${created.length}`, lines: ticketLines(guild, created), inline: true }]
        : [],
    actor: interaction.user,
  });
}
