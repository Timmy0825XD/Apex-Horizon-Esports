import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild } from "discord.js";
import { auditLogTitles, publishAudit } from "../../lib/audit.js";
import { formatCategory, formatChannel, formatRole, formatSheetLink } from "../../lib/formatters.js";
import {
  optionalTextChannelFields,
  roleFields,
  textChannelFields,
  type TournamentRecord,
} from "./fields.js";
import type { DeletedRelated } from "./store.js";

function worldDetails(guild: Guild, tournament: TournamentRecord, changed?: string[]): string[] {
  const include = (key: string) => !changed || changed.includes(key);
  const lines: string[] = [];

  if (include("name")) {
    lines.push(`**Name:** **${tournament.name}**`);
  }
  if (include("challongeId")) {
    lines.push(`**Bracket:** \`${tournament.challongeId}\``);
  }
  if (include("format")) {
    lines.push(`**Format:** \`${tournament.format}\``);
  }
  if (include("additionalFieldCount")) {
    lines.push(`**Extra columns:** \`${tournament.additionalFieldCount}\``);
  }
  if (include("sheetLink")) {
    lines.push(`**Sheet:** ${formatSheetLink(tournament.sheetLink)}`);
  }
  if (include("autoRoomCapable")) {
    lines.push(`**Auto-room:** ${tournament.autoRoomCapable ? "Capable" : "Off"}`);
  }
  if (include("key")) {
    lines.push("**API key:** *Updated (encrypted)*");
  }

  for (const field of roleFields) {
    if (include(field.key)) {
      lines.push(`**${field.label}:** ${formatRole(guild, tournament[field.key])}`);
    }
  }
  for (const field of textChannelFields) {
    if (include(field.key)) {
      lines.push(`**${field.label}:** ${formatChannel(guild, tournament[field.key])}`);
    }
  }
  for (const field of optionalTextChannelFields) {
    if (include(field.key)) {
      const id = tournament[field.key];
      lines.push(`**${field.label}:** ${id ? formatChannel(guild, id) : "*Not configured*"}`);
    }
  }
  if (include("closedTicketCategoryId")) {
    lines.push(`**Closed Tickets:** ${formatCategory(guild, tournament.closedTicketCategoryId)}`);
  }
  if (include("closeTicketCategory2Id")) {
    lines.push(
      `**Closed Tickets 2:** ${tournament.closeTicketCategory2Id ? formatCategory(guild, tournament.closeTicketCategory2Id) : "*Not configured*"}`,
    );
  }
  if (include("ticketOpenCategoryIds")) {
    tournament.ticketOpenCategoryIds.forEach((id, index) => {
      lines.push(`**Open Tickets ${index + 1}:** ${formatCategory(guild, id)}`);
    });
  }

  return lines;
}

export async function auditTournamentAdd(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  tournament: TournamentRecord,
): Promise<void> {
  const details = worldDetails(guild, tournament);
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: `Tournament **${tournament.name}** was registered.`,
    details,
    actor: interaction.user,
  });
  await publishAudit({
    guild,
    channelId: settings.challongeLogsChannelId,
    title: auditLogTitles.challongeLogs,
    description: `Bracket identity **${tournament.name}** was linked as \`${tournament.challongeId}\`.`,
    details: [`**Tournament:** **${tournament.name}**`, `**Bracket:** \`${tournament.challongeId}\``],
    actor: interaction.user,
  });
}

export async function auditTournamentEdit(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  tournament: TournamentRecord,
  changed: string[],
  keyChanged: boolean,
): Promise<void> {
  const flags = keyChanged ? [...changed, "key"] : changed;
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: `Tournament **${tournament.name}** was edited.`,
    details: worldDetails(guild, tournament, flags),
    actor: interaction.user,
  });
  if (keyChanged) {
    await publishAudit({
      guild,
      channelId: settings.challongeLogsChannelId,
      title: auditLogTitles.challongeLogs,
      description: `Bracket credentials for **${tournament.name}** were replaced.`,
      details: [`**Tournament:** **${tournament.name}**`, `**Bracket:** \`${tournament.challongeId}\``],
      actor: interaction.user,
    });
  }
}

export async function auditTournamentDelete(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  name: string,
  challongeId: string,
  related: DeletedRelated,
): Promise<void> {
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description: `Tournament **${name}** was deleted. Related bot records were wiped; the stored sheet remains historical.`,
    details: [
      `**Name:** **${name}**`,
      `**Bracket:** \`${challongeId}\``,
      `**Matches deleted:** \`${related.matches}\``,
      `**Rooms deleted:** \`${related.rooms}\``,
      `**Schedules deleted:** \`${related.schedules}\``,
      `**Attendance deleted:** \`${related.attendances}\``,
    ],
    actor: interaction.user,
  });
}

export async function auditAddSheet(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  details: string[],
): Promise<void> {
  const count = details.length;
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    title: auditLogTitles.botLogs,
    description:
      count === 1
        ? "A participant sheet was archived into the global player search."
        : `**${count}** participant sheets were archived into the global player search.`,
    details,
    actor: interaction.user,
  });
}
