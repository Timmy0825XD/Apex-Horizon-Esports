import { ContainerBuilder, MessageFlags, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry, formatSheetLink, formatUser } from "../../lib/formatters.js";
import { PLAYER_FIELDS, playerBlockStart, playerSlotLabel, type SheetPlayer, type TeamFormat } from "../../lib/sheet.js";
import { textBlock, v2Flags } from "../../lib/v2.js";
import type { SheetOrigin, StoredSheetRecord } from "../tournament/store.js";

export function sheetErrorMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
  };
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
  const findPlayer = formatHelpEntry("sheet find_player", commandId);

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

export function sheetArchiveResultMessage(
  sourceGuildName: string,
  archived: SheetArchiveOk[],
  skipped: SheetArchiveSkip[],
  failed: SheetArchiveFail[],
  commandId?: string,
): InteractionReplyOptions {
  const containers = buildArchiveContainers(sourceGuildName, archived, skipped, failed, commandId);
  if (containers.length === 0) {
    return sheetErrorMessage("Nothing archived", "No sheets were stored in the global archive.", false);
  }
  return { flags: v2Flags, components: containers };
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

export type SheetIssueKind =
  | "banned"
  | "duplicate-discord"
  | "duplicate-game"
  | "discord-id"
  | "game-id"
  | "account-age"
  | "staff-role"
  | "membership"
  | "tag";

export type SheetValidateReport = {
  format: string;
  teams: number;
  players: number;
  staffConfigured: boolean;
  buckets: { kind: SheetIssueKind; lines: string[] }[];
};

const ISSUE_COPY: Record<SheetIssueKind, { title: string; body: string }> = {
  banned: {
    title: "Banned in-game IDs",
    body: "These in-game IDs are on the official banned list. Take them off the Google Sheet before registering the tournament.",
  },
  "duplicate-discord": {
    title: "Duplicate Discord IDs",
    body: "Each Discord ID can appear once on the sheet. These values are repeated.",
  },
  "duplicate-game": {
    title: "Duplicate in-game IDs",
    body: "Each in-game ID can appear once on the sheet. These values are repeated.",
  },
  "discord-id": {
    title: "Discord IDs to fix",
    body: "These Discord IDs are missing or not snowflakes. A tag match is only a hint: write the real ID on the sheet.",
  },
  "game-id": {
    title: "In-game IDs to fix",
    body: "An in-game ID has to be **8–16** hex characters, ignoring spaces.",
  },
  "account-age": {
    title: "Accounts not older than 30 days",
    body: "Discord accounts have to be older than **30 days**.",
  },
  "staff-role": {
    title: "Staff roles on the roster",
    body: "Players cannot hold the server **Staff**, **Judge**, or **Recorder** role.",
  },
  membership: {
    title: "Not in this server",
    body: "These Discord IDs are valid, and those people are not members of this server.",
  },
  tag: {
    title: "Discord tags do not match",
    body: "The tag on the sheet has to match that member's Discord username.",
  },
};

function clipLines(lines: string[]): string {
  const max = 12;
  if (lines.length <= max) {
    return lines.join("\n");
  }
  const extra = lines.length - max;
  return `${lines.slice(0, max).join("\n")}\n*And **${extra}** more.*`;
}

export function sheetValidateMessage(
  report: SheetValidateReport,
  commandIds: { tournamentCommandId?: string; utilityCommandId?: string },
): InteractionReplyOptions {
  const issueCount = report.buckets.reduce((sum, bucket) => sum + bucket.lines.length, 0);
  const containers = [];

  if (issueCount === 0) {
    const register = formatHelpEntry("tournament add", commandIds.tournamentCommandId);
    const staffNote = report.staffConfigured
      ? ""
      : "\nStaff, judge, and recorder roles are not configured, so that check was skipped.";
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.success} Sheet passed`),
          textBlock(
            `Checked **${report.players}** player${report.players === 1 ? "" : "s"} in **${report.teams}** team${report.teams === 1 ? "" : "s"} (\`${report.format}\`). Nothing failed.${staffNote}`,
          ),
          textBlock(`Register the tournament with ${register} when you are ready. This check does not store the sheet.`),
        ),
    );
  } else {
    const staffNote = report.staffConfigured
      ? ""
      : " Staff, judge, and recorder roles are not configured, so that check was skipped.";
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} Sheet needs fixes`),
          textBlock(
            `**${issueCount}** check${issueCount === 1 ? "" : "s"} failed across **${report.players}** player${report.players === 1 ? "" : "s"} in **${report.teams}** team${report.teams === 1 ? "" : "s"} (\`${report.format}\`).${staffNote}`,
          ),
          textBlock("The tournament was not created. Correct the Google Sheet, then run this again."),
        ),
    );
  }

  for (const bucket of report.buckets) {
    const copy = ISSUE_COPY[bucket.kind];
    const tagHint =
      bucket.kind === "tag"
        ? `\n${formatHelpEntry("utility discord_tag", commandIds.utilityCommandId)} turns Discord IDs into usernames in sheet order.`
        : "";
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.error} ${copy.title}`),
          textBlock(`${copy.body}${tagHint}\n\n${clipLines(bucket.lines)}`),
        ),
    );
  }

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: containers,
  };
}
