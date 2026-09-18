import {
  ContainerBuilder,
  MessageFlags,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import {
  formatCategory,
  formatChannel,
  formatHelpEntry,
  formatRole,
  formatSheetLink,
  formatUser,
} from "../../lib/formatters.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import {
  optionalTextChannelFields,
  playerBlockStart,
  playerSlotLabel,
  PLAYER_FIELDS,
  roleFields,
  textChannelFields,
  type TeamFormat,
  type TournamentRecord,
} from "./fields.js";
import type { DeletedRelated, SheetOrigin, StoredSheetRecord } from "./store.js";
import type { BannedPlayerHit } from "./banned-ids.js";
import type { SheetPlayer } from "./sheet.js";

export type TournamentPanelKind = "add" | "edit" | "info";

function roleLine(guild: Guild, id: string, label: string): string {
  const mention = formatRole(guild, id);
  if (guild.roles.cache.has(id)) {
    return `> **${label}:** ${mention}`;
  }
  return `${emojis.error} **${label}:** ${mention} *Missing from this server*`;
}

function channelLine(guild: Guild, id: string, label: string, category = false): string {
  const mention = category ? formatCategory(guild, id) : formatChannel(guild, id);
  if (guild.channels.cache.has(id)) {
    return `> **${label}:** ${mention}`;
  }
  return `${emojis.error} **${label}:** ${mention} *Missing from this server*`;
}

function worldSections(guild: Guild, tournament: TournamentRecord): string[] {
  const auto = tournament.autoRoomCapable
    ? tournament.autoRoomRunning
      ? "Capable · *currently running*"
      : "Capable · *idle until auto-room run*"
    : "Off";

  const identity = [
    `## ${emojis.id} Identity`,
    `> **Name:** **${tournament.name}**`,
    `> **Bracket:** \`${tournament.challongeId}\``,
    `> **Format:** \`${tournament.format}\``,
    `> **Extra columns:** \`${tournament.additionalFieldCount}\``,
    `> **Sheet:** ${formatSheetLink(tournament.sheetLink)}`,
    `> **Auto-room:** ${auto}`,
    `> **API key:** *Stored encrypted*`,
  ].join("\n");

  const roles = [
    `## ${emojis.members} Roles`,
    ...roleFields.map((field) => roleLine(guild, tournament[field.key], field.label)),
  ].join("\n");

  const channelLines = [
    ...textChannelFields.map((field) => channelLine(guild, tournament[field.key], field.label)),
    ...optionalTextChannelFields.flatMap((field) => {
      const id = tournament[field.key];
      return id ? [channelLine(guild, id, field.label)] : [];
    }),
  ];
  const channels = [`## ${emojis.textChannel} Channels`, ...channelLines].join("\n");

  const tickets = [
    channelLine(guild, tournament.closedTicketCategoryId, "Closed Tickets", true),
    ...(tournament.closeTicketCategory2Id
      ? [channelLine(guild, tournament.closeTicketCategory2Id, "Closed Tickets 2", true)]
      : []),
    ...tournament.ticketOpenCategoryIds.flatMap((id, index) =>
      id ? [channelLine(guild, id, `Open Tickets ${index + 1}`, true)] : [],
    ),
  ];
  const ticketCategories = [`## ${emojis.categories} Ticket categories`, ...tickets].join("\n");

  return [identity, roles, channels, ticketCategories];
}

function panelCopy(kind: Exclude<TournamentPanelKind, "info">): { title: string; note: string; color: number } {
  if (kind === "add") {
    return {
      title: `${emojis.success} Tournament registered`,
      note: "This world is now operable: sheet copied, bracket linked, rooms and tickets will use these channels.",
      color: embedColors.success,
    };
  }
  return {
    title: `${emojis.success} Tournament updated`,
    note: "Only the values you changed were rewritten. Auto-room capability applies immediately.",
    color: embedColors.success,
  };
}

export function tournamentWorldMessage(
  kind: TournamentPanelKind,
  guild: Guild,
  tournament: TournamentRecord,
  commandId?: string,
  thumbnailUrl?: string,
): InteractionReplyOptions {
  const copy =
    kind === "info"
      ? {
          title: `${emojis.info} **${tournament.name}**`,
          note: `Use ${formatHelpEntry("tournament edit", commandId)} to change a role, channel, sheet, or key.`,
          color: embedColors.info,
        }
      : panelCopy(kind);

  const container = new ContainerBuilder().setAccentColor(copy.color);
  if (thumbnailUrl && (kind === "add" || kind === "edit")) {
    container.addSectionComponents(headingWithThumbnail(`# ${copy.title}`, thumbnailUrl, copy.note));
  } else {
    container.addTextDisplayComponents(textBlock(`# ${copy.title}`), textBlock(copy.note));
  }

  for (const section of worldSections(guild, tournament)) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(section));
  }

  if (tournament.createdBy) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock(`-# Created by ${formatUser(tournament.createdBy)}`));
  }

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [container],
  };
}

export function tournamentErrorMessage(
  title: string,
  description: string,
  ephemeral = true,
): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
  };
}

const MAX_BANNED_SHOWN = 15;

function bannedPlayerLine(hit: BannedPlayerHit): string {
  const who = hit.gameName || hit.discordTag || "Unknown player";
  const team = hit.teamName ? `**${hit.teamName}** · ` : "";
  const discord =
    hit.discordId && /^\d{17,20}$/.test(hit.discordId)
      ? ` · ${formatUser(hit.discordId)}`
      : hit.discordTag
        ? ` · **${hit.discordTag}**`
        : "";
  return `> ${team}**${hit.slotLabel}:** **${who}** · \`${hit.gameId}\`${discord}`;
}

export function tournamentBannedPlayersMessage(hits: BannedPlayerHit[], kind: "add" | "edit"): InteractionReplyOptions {
  const shown = hits.slice(0, MAX_BANNED_SHOWN);
  const extra = hits.length - shown.length;
  const title =
    hits.length === 1 ? "Banned in-game ID on the roster" : "Banned in-game IDs on the roster";
  const action =
    kind === "add"
      ? "This tournament was **not** registered."
      : "The participant sheet was **not** updated.";
  const count =
    hits.length === 1
      ? "One player on this sheet is on the official banned-ID list."
      : `**${hits.length}** players on this sheet are on the official banned-ID list.`;
  const more =
    extra > 0 ? `\n*And **${extra}** more. Remove every listed in-game ID from the Google Sheet.*` : "";

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} ${title}`),
          textBlock(`${count} ${action} Remove them from the sheet, then try again.`),
          textBlock(`${shown.map(bannedPlayerLine).join("\n")}${more}`),
        ),
    ],
  };
}

export function tournamentListMessage(tournaments: TournamentRecord[]): InteractionReplyOptions {
  if (tournaments.length === 0) {
    return {
      flags: [...v2Flags, MessageFlags.Ephemeral],
      components: [
        new ContainerBuilder()
          .setAccentColor(embedColors.info)
          .addTextDisplayComponents(
            textBlock(`# ${emojis.info} No tournaments yet`),
            textBlock("This server has no operable tournaments. An **Admin** can register one with `/tournament add`."),
          ),
      ],
    };
  }

  const lines = tournaments.map((row, index) => {
    const auto = row.autoRoomCapable ? "auto-room capable" : "auto-room off";
    return `${index + 1}. **${row.name}** · \`${row.challongeId}\` · \`${row.format}\` · *${auto}*`;
  });

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.server} Tournaments in this server`),
          textBlock(`**${tournaments.length}** active of **4** allowed.`),
          textBlock(lines.join("\n")),
        ),
    ],
  };
}

export function tournamentDeletedMessage(
  name: string,
  related: DeletedRelated,
  commandId?: string,
): InteractionReplyOptions {
  const findPlayer = formatHelpEntry("tournament find_player", commandId);
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addTextDisplayComponents(
      textBlock(`# ${emojis.success} Tournament removed`),
      textBlock(`**${name}** is no longer operable in this server. Auto-room for this world is off.`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `## ${emojis.mongo} Cleared from the bot`,
          `> **Matches:** \`${related.matches}\``,
          `> **Rooms:** \`${related.rooms}\``,
          `> **Schedules:** \`${related.schedules}\``,
          `> **Attendance:** \`${related.attendances}\``,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `## ${emojis.info} Left in place`,
          `> **Participant sheet:** historical archive`,
          `> **Discord channels:** not deleted`,
          `> **Google Sheet:** not deleted`,
          `> **Challonge bracket:** not deleted`,
        ].join("\n"),
      ),
      textBlock(`${findPlayer} can still search that archive.`),
    );

  return {
    flags: v2Flags,
    components: [container],
  };
}

export function tournamentSheetArchiveResultMessage(
  sourceGuildName: string,
  archived: SheetArchiveOk[],
  skipped: SheetArchiveSkip[],
  failed: SheetArchiveFail[],
  commandId?: string,
): InteractionReplyOptions {
  const containers: ReturnType<typeof buildArchiveContainers> = buildArchiveContainers(
    sourceGuildName,
    archived,
    skipped,
    failed,
    commandId,
  );
  if (containers.length === 0) {
    return tournamentErrorMessage("Nothing archived", "No sheets were stored in the global archive.", false);
  }
  return { flags: v2Flags, components: containers };
}

export type SheetArchiveOk = {
  name: string;
  sheetLink: string;
  format: string;
  teams: number;
  extraColumns: number;
  guildName: string;
};

export type SheetArchiveSkip = {
  name: string;
  sheetLink: string;
  reason: string;
};

export type SheetArchiveFail = {
  name: string;
  sheetLink: string;
  reason: string;
};

function extraColumnNote(extraColumns: number): string {
  return extraColumns === 0
    ? "No extra columns."
    : `**${extraColumns}** extra column${extraColumns === 1 ? "" : "s"} stored for \`/team\`.`;
}

function namedLink(name: string, sheetLink: string): string {
  return sheetLink ? `${formatSheetLink(sheetLink)}` : `**${name}**`;
}

function buildArchiveContainers(
  sourceGuildName: string,
  archived: SheetArchiveOk[],
  skipped: SheetArchiveSkip[],
  failed: SheetArchiveFail[],
  commandId?: string,
) {
  const containers = [];
  const findPlayer = formatHelpEntry("tournament find_player", commandId);

  if (archived.length === 1 && skipped.length === 0 && failed.length === 0) {
    const row = archived[0];
    if (row) {
      containers.push(
        new ContainerBuilder()
          .setAccentColor(embedColors.success)
          .addTextDisplayComponents(
            textBlock(`# ${emojis.success} Sheet archived`),
            textBlock(
              `**${row.name}** from **${row.guildName}** is now in the **global** player archive. Detected **${row.format}** with **${row.teams}** teams. ${extraColumnNote(row.extraColumns)}`,
            ),
            textBlock(`${findPlayer} can search it from any server.`),
            textBlock(`${formatSheetLink(row.sheetLink)}\n*This is not an operable tournament.*`),
          ),
      );
    }
  } else if (archived.length > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.success} Sheets archived`),
          textBlock(
            `Stored **${archived.length}** participant sheet${archived.length === 1 ? "" : "s"} from **${sourceGuildName}** in the global archive.`,
          ),
          textBlock(`${findPlayer} can search them from any server.`),
          textBlock(
            archived
              .map((row) => `> **${row.name}** · \`${row.format}\` · **${row.teams}** teams · ${formatSheetLink(row.sheetLink)}`)
              .join("\n"),
          ),
        ),
    );
  }

  if (skipped.length > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.info} Already in the archive`),
          textBlock(
            `Skipped **${skipped.length}** sheet${skipped.length === 1 ? "" : "s"} because that Google Sheet was already stored globally.`,
          ),
          textBlock(
            skipped
              .map((row) => `> **${row.name}** · ${namedLink(row.name, row.sheetLink)}\n> *${row.reason}*`)
              .join("\n"),
          ),
        ),
    );
  }

  if (failed.length > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} Could not archive`),
          textBlock(`**${failed.length}** row${failed.length === 1 ? "" : "s"} did not make it into the archive.`),
          textBlock(
            failed
              .map((row) =>
                row.sheetLink
                  ? `> **${row.name}** · ${formatSheetLink(row.sheetLink)}\n> *${row.reason}*`
                  : `> **${row.name}:** ${row.reason}`,
              )
              .join("\n"),
          ),
        ),
    );
  }

  return containers;
}

function originLabel(origin: SheetOrigin): string {
  if (origin === "historical") {
    return "historical";
  }
  if (origin === "manual") {
    return "manual archive";
  }
  return "active tournament";
}

function sheetTitle(sheet: StoredSheetRecord): string {
  const event = sheet.tournamentName ? `**${sheet.tournamentName}**` : "Manual sheet";
  const server = sheet.guildName || "Unknown server";
  return `${event} (\`${sheet.format}\`, ${originLabel(sheet.origin)})\n> **Server:** **${server}**`;
}

function playerFieldLines(player: SheetPlayer, headers: string[], format: TeamFormat): string[] {
  const start = playerBlockStart(format) + player.slot * PLAYER_FIELDS.length;
  return PLAYER_FIELDS.map((field, index) => {
    const label = headers[start + index] || `${playerSlotLabel(player.slot)} ${field.label}`;
    const value = player[field.key];
    if (!value) {
      return `> **${label}:** *Empty*`;
    }
    if (field.key === "discordId" && /^\d{17,20}$/.test(value)) {
      return `> **${label}:** ${formatUser(value)}`;
    }
    if (field.key === "gameName" || field.key === "discordTag" || field.key === "currentTitle") {
      return `> **${label}:** **${value}**`;
    }
    return `> **${label}:** \`${value}\``;
  });
}

export type PlayerHit = {
  identity: string;
  displayName: string;
  teamName: string;
  format: TeamFormat;
  captain: SheetPlayer;
  headers: string[];
  sheets: StoredSheetRecord[];
};

export function playerFoundMessages(hits: PlayerHit[]): InteractionReplyOptions {
  if (hits.length === 0) {
    return {
      flags: [...v2Flags, MessageFlags.Ephemeral],
      components: [
        new ContainerBuilder()
          .setAccentColor(embedColors.error)
          .addTextDisplayComponents(
            textBlock(`# ${emojis.error} No players matched`),
            textBlock("None of the stored sheets across this bot matched those identifiers. Try another field or a shorter name."),
          ),
      ],
    };
  }

  const shown = hits.slice(0, 5);
  const extra = hits.length - shown.length;
  const containers = shown.map((hit, index) => {
    const sheetLines = hit.sheets.map((sheet) => `> ${sheetTitle(sheet)}\n> ${formatSheetLink(sheet.sheetLink)}`);
    const note =
      hits.length === 1
        ? `Matched **${hit.displayName}** in **${hit.sheets.length}** stored sheet${hit.sheets.length === 1 ? "" : "s"}.`
        : `Player **${index + 1}** of **${hits.length}**: **${hit.displayName}** appeared in **${hit.sheets.length}** sheet${hit.sheets.length === 1 ? "" : "s"}.`;

    const captainLines = playerFieldLines(hit.captain, hit.headers, hit.format);
    const teamLine =
      hit.format === "1vs1" || !hit.teamName
        ? captainLines.join("\n")
        : `> **Team:** **${hit.teamName}**\n${captainLines.join("\n")}`;

    return new ContainerBuilder()
      .setAccentColor(embedColors.info)
      .addTextDisplayComponents(
        textBlock(`# ${emojis.members} ${hit.displayName}`),
        textBlock(note),
        textBlock(`**Captain of their team**\n${teamLine}`),
        textBlock(`**Sheets**\n${sheetLines.join("\n")}`),
      );
  });

  if (extra > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.next} More matches`),
          textBlock(`**${extra}** more distinct player${extra === 1 ? "" : "s"} matched. Narrow the search with a Discord ID or in-game ID.`),
        ),
    );
  }

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    components: containers,
  };
}
