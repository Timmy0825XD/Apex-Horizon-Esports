import type { GuildSettings } from "@prisma/client";
import type { ButtonInteraction, ChatInputCommandInteraction, Guild, User } from "discord.js";
import { fact, listWithOverflow, publishAudit } from "../../lib/audit.js";
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
    lines.push(`**Name** **${tournament.name}**`);
  }
  if (include("challongeId")) {
    lines.push(`**Bracket** \`${tournament.challongeId}\``);
  }
  if (include("format")) {
    lines.push(`**Format** \`${tournament.format}\``);
  }
  if (include("additionalFieldCount")) {
    lines.push(`**Extra columns** \`${tournament.additionalFieldCount}\``);
  }
  if (include("sheetLink")) {
    lines.push(`**Sheet** ${formatSheetLink(tournament.sheetLink)}`);
  }
  if (include("key")) {
    lines.push("**API key** *Updated (encrypted)*");
  }

  for (const field of roleFields) {
    if (include(field.key)) {
      lines.push(`**${field.label}** ${formatRole(guild, tournament[field.key])}`);
    }
  }
  for (const field of textChannelFields) {
    if (include(field.key)) {
      lines.push(`**${field.label}** ${formatChannel(guild, tournament[field.key])}`);
    }
  }
  for (const field of optionalTextChannelFields) {
    if (include(field.key)) {
      const id = tournament[field.key];
      lines.push(`**${field.label}** ${id ? formatChannel(guild, id) : "*Not configured*"}`);
    }
  }
  if (include("closedTicketCategoryId")) {
    lines.push(`**Closed Tickets** ${formatCategory(guild, tournament.closedTicketCategoryId)}`);
  }
  if (include("closeTicketCategory2Id")) {
    lines.push(
      `**Closed Tickets 2** ${tournament.closeTicketCategory2Id ? formatCategory(guild, tournament.closeTicketCategory2Id) : "*Not configured*"}`,
    );
  }
  if (include("ticketOpenCategoryIds")) {
    tournament.ticketOpenCategoryIds.forEach((id, index) => {
      lines.push(`**Open Tickets ${index + 1}** ${formatCategory(guild, id)}`);
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
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "tournaments",
    action: "created",
    title: "Tournament registered",
    summary: `**${tournament.name}** was registered and is ready to run.`,
    groups: [{ label: "Setup", lines: worldDetails(guild, tournament) }],
    actor: interaction.user,
  });
  await publishAudit({
    guild,
    channelId: settings.challongeLogsChannelId,
    module: "challonge",
    action: "created",
    title: "Bracket linked",
    summary: `**${tournament.name}** was linked to its Challonge bracket.`,
    groups: [{ lines: [fact("Bracket", `\`${tournament.challongeId}\``)] }],
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
    module: "tournaments",
    action: "updated",
    title: "Tournament edited",
    summary: `**${flags.length}** ${flags.length === 1 ? "setting" : "settings"} of **${tournament.name}** changed.`,
    groups: [{ label: "New values", lines: worldDetails(guild, tournament, flags) }],
    actor: interaction.user,
  });
  if (keyChanged) {
    await publishAudit({
      guild,
      channelId: settings.challongeLogsChannelId,
      module: "challonge",
      action: "updated",
      title: "Bracket key replaced",
      summary: `The Challonge credentials of **${tournament.name}** were replaced.`,
      groups: [{ lines: [fact("Bracket", `\`${tournament.challongeId}\``)] }],
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
    module: "tournaments",
    action: "deleted",
    title: "Tournament deleted",
    summary: `**${name}** was removed. Its bot records were wiped; the stored sheet stays as history.`,
    groups: [
      { lines: [fact("Bracket", `\`${challongeId}\``)] },
      {
        label: "Records removed",
        lines: [
          `\`${related.matches}\` matches`,
          `\`${related.rooms}\` rooms`,
          `\`${related.schedules}\` schedules`,
          `\`${related.attendances}\` attendance`,
        ],
        inline: true,
      },
    ],
    actor: interaction.user,
  });
}

export async function auditTournamentRole(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guild: Guild,
  settings: GuildSettings,
  tournamentName: string,
  roleId: string,
  scope: string,
  assigned: number,
): Promise<void> {
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "tournaments",
    action: "created",
    title: "Tournament role assigned",
    summary: `${formatRole(guild, roleId)} was given to \`${assigned}\` ${assigned === 1 ? "player" : "players"} of **${tournamentName}**.`,
    groups: [{ lines: [fact("Scope", `**${scope}**`)] }],
    actor: interaction.user,
  });
}

export async function auditValidationTickets(
  guild: Guild,
  settings: GuildSettings,
  actor: User,
  tournamentName: string,
  transcriptChannelId: string,
  created: { channelId: string }[],
  notOpened: number,
): Promise<void> {
  if (created.length === 0) {
    return;
  }
  const extra = [fact("Transcripts in", formatChannel(guild, transcriptChannelId))];
  if (notOpened > 0) {
    extra.push(fact("Not opened", `\`${notOpened}\``));
  }
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "tournaments",
    action: "created",
    title: created.length === 1 ? "Validation ticket opened" : "Validation tickets opened",
    summary:
      created.length === 1
        ? `A group validation ticket was opened for **${tournamentName}**.`
        : `\`${created.length}\` group validation tickets were opened for **${tournamentName}**.`,
    groups: [
      {
        label: `Tickets opened · ${created.length}`,
        lines: listWithOverflow(created.map((ticket) => formatChannel(guild, ticket.channelId))),
        inline: true,
      },
      { lines: extra },
    ],
    actor,
  });
}

/** `sheets` is how many sheets were archived; `lines` may spend more than one line per sheet. */
export async function auditAddSheet(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  settings: GuildSettings,
  sheets: number,
  lines: string[],
): Promise<void> {
  await publishAudit({
    guild,
    channelId: settings.botLogsChannelId,
    module: "tournaments",
    action: "created",
    title: sheets === 1 ? "Sheet archived" : "Sheets archived",
    summary:
      sheets === 1
        ? "A participant sheet joined the global player search."
        : `\`${sheets}\` participant sheets joined the global player search.`,
    groups: [{ lines: listWithOverflow(lines) }],
    actor: interaction.user,
  });
}
