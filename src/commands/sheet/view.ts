import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatHelpEntry, formatSheetLink, formatUser } from "../../lib/formatters.js";
import type { SheetPlayer, TeamFormat } from "../../lib/sheet.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { formatCurrentTitle } from "../team/view.js";
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

function stamp(): string {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

/** Link button to the Google Sheet; null when the stored value is not a web URL. */
export function sheetButtonRow(sheetLink: string): ActionRowBuilder<ButtonBuilder> | null {
  if (!/^https?:\/\//i.test(sheetLink.trim())) {
    return null;
  }
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(sheetLink.trim())
      .setLabel("Open sheet")
      .setEmoji(customEmoji(emojis.link)),
  );
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

function plural(count: number, one: string, many: string): string {
  return `\`${count}\` ${count === 1 ? one : many}`;
}

function linkSuffix(sheetLink: string): string {
  return sheetLink ? ` · ${formatSheetLink(sheetLink)}` : "";
}

function buildArchiveContainers(
  sourceGuildName: string,
  archived: SheetArchiveOk[],
  skipped: SheetArchiveSkip[],
  failed: SheetArchiveFail[],
  actorId: string,
  commandId?: string,
) {
  const containers = [];
  const findPlayer = formatHelpEntry("sheet find player", commandId);
  const footer = `-# Archived by ${formatUser(actorId)} · ${stamp()} · search it from any server with ${findPlayer}`;

  if (archived.length === 1 && skipped.length === 0 && failed.length === 0) {
    const row = archived[0];
    if (row) {
      const extra = row.extraColumns === 0 ? "no extra columns" : `${plural(row.extraColumns, "extra column", "extra columns")} for \`/team\``;
      const container = new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.success} Sheet Archived\n-# Global archive · not an operable tournament`),
          textBlock(
            [
              `${emojis.torneo} **${escapeDiscord(row.name)}** · \`${row.format}\` · ${plural(row.teams, "team", "teams")}`,
              `${emojis.server} From **${escapeDiscord(row.guildName)}** · ${extra}`,
            ].join("\n"),
          ),
        );
      const button = sheetButtonRow(row.sheetLink);
      if (button) {
        container.addActionRowComponents(button);
      }
      containers.push(container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(footer)));
    }
  } else if (archived.length > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(
            `## ${emojis.success} Sheets Archived\n${plural(archived.length, "sheet", "sheets")} from **${escapeDiscord(sourceGuildName)}** are now in the global archive.`,
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(
          textBlock(
            archived
              .map(
                (row) =>
                  `- **${escapeDiscord(row.name)}** · \`${row.format}\` · ${plural(row.teams, "team", "teams")}${linkSuffix(row.sheetLink)}`,
              )
              .join("\n"),
          ),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(footer)),
    );
  }

  if (skipped.length > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(
            `## ${emojis.info} Already in the Archive · ${skipped.length}\n-# That Google Sheet was already stored globally, so it was skipped.`,
          ),
          textBlock(
            skipped
              .map((row) => `- **${escapeDiscord(row.name)}**${linkSuffix(row.sheetLink)} · *${row.reason}*`)
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
          textBlock(`## ${emojis.error} Could Not Archive · ${failed.length}\n-# These rows did not make it into the archive.`),
          textBlock(
            failed
              .map((row) => `- **${escapeDiscord(row.name)}**${linkSuffix(row.sheetLink)} · *${row.reason}*`)
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
  actorId: string,
  commandId?: string,
): InteractionReplyOptions {
  const containers = buildArchiveContainers(sourceGuildName, archived, skipped, failed, actorId, commandId);
  if (containers.length === 0) {
    return sheetErrorMessage("Nothing archived", "No sheets were stored in the global archive.", false);
  }
  return { flags: v2Flags, components: containers, allowedMentions: { parse: [] } };
}

export function originLabel(origin: SheetOrigin): string {
  if (origin === "historical") {
    return "historical";
  }
  if (origin === "manual") {
    return "manual archive";
  }
  return "active tournament";
}

function sheetLine(sheet: StoredSheetRecord): string {
  const event = sheet.tournamentName ? `**${escapeDiscord(sheet.tournamentName)}**` : "Manual sheet";
  const server = sheet.guildName ? ` · **${escapeDiscord(sheet.guildName)}**` : "";
  return `- ${event} · \`${sheet.format}\` · ${originLabel(sheet.origin)}${server}${linkSuffix(sheet.sheetLink)}`;
}

function playerLines(player: SheetPlayer, teamName: string, format: TeamFormat): string[] {
  const lines: string[] = [];
  if (format !== "1vs1" && teamName) {
    lines.push(`${emojis.humans} **Team** ${escapeDiscord(teamName)} · captain`);
  }
  const tag = player.discordTag ? `**${escapeDiscord(player.discordTag)}**` : "*No tag*";
  const id = /^\d{17,20}$/.test(player.discordId)
    ? formatUser(player.discordId)
    : player.discordId
      ? `\`${escapeDiscord(player.discordId)}\``
      : "*no ID*";
  lines.push(`**Discord** ${tag} · ${id}`);
  const gameName = player.gameName ? `**${escapeDiscord(player.gameName)}**` : "*No name*";
  const gameId = player.gameId ? `\`${escapeDiscord(player.gameId)}\`` : "*no ID*";
  lines.push(`**In-game** ${gameName} · ${gameId}`);
  if (player.currentTitle.trim()) {
    lines.push(`**Title** ${formatCurrentTitle(escapeDiscord(player.currentTitle))}`);
  }
  return lines;
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
            textBlock(`## ${emojis.error} No Players Matched`),
            textBlock("None of the stored sheets across this bot matched those identifiers. Try another field or a shorter name."),
          ),
      ],
    };
  }

  const shown = hits.slice(0, 5);
  const extra = hits.length - shown.length;
  const containers = shown.map((hit, index) => {
    const found = `Found in ${hit.sheets.length} stored ${hit.sheets.length === 1 ? "sheet" : "sheets"}`;
    const position = hits.length > 1 ? `Player ${index + 1} of ${hits.length} · ${found}` : found;
    return new ContainerBuilder()
      .setAccentColor(embedColors.info)
      .addTextDisplayComponents(
        textBlock(`## ${emojis.members} ${escapeDiscord(hit.displayName)}\n-# ${position}`),
        textBlock(playerLines(hit.captain, hit.teamName, hit.format).join("\n")),
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(textBlock([`### ${emojis.torneo} Sheets`, ...hit.sheets.map(sheetLine)].join("\n")));
  });

  if (extra > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.next} More Matches · ${extra}`),
          textBlock("Narrow the search with a Discord ID or in-game ID."),
        ),
    );
  }

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
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
    body: "Each Discord ID can appear once on the sheet.",
  },
  "duplicate-game": {
    title: "Duplicate in-game IDs",
    body: "Each in-game ID can appear once on the sheet.",
  },
  "discord-id": {
    title: "Discord IDs to fix",
    body: "These Discord IDs are missing or not snowflakes. A tag match is only a hint: write the real ID on the sheet.",
  },
  "game-id": {
    title: "In-game IDs to fix",
    body: "An in-game ID has to be 8–16 hex characters, ignoring spaces.",
  },
  "account-age": {
    title: "Accounts not older than 30 days",
    body: "Discord accounts have to be older than 30 days.",
  },
  "staff-role": {
    title: "Staff roles on the roster",
    body: "Players cannot hold the server Staff, Judge, or Recorder role.",
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
  commandIds: { tournamentCommandId?: string; utilityCommandId?: string; sheetCommandId?: string },
): InteractionReplyOptions {
  const issueCount = report.buckets.reduce((sum, bucket) => sum + bucket.lines.length, 0);
  const containers = [];
  const facts = `\`${report.format}\` · ${plural(report.teams, "team", "teams")} · ${plural(report.players, "player", "players")}`;
  const staffNote = report.staffConfigured
    ? []
    : [`${emojis.info} *Staff, judge, and recorder roles are not configured, so that check was skipped.*`];

  if (issueCount === 0) {
    const register = formatHelpEntry("tournament add", commandIds.tournamentCommandId);
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.success} Sheet Passed\n-# This check does not store the sheet`),
          textBlock([`${facts} · nothing failed`, ...staffNote].join("\n")),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(`-# Register the tournament with ${register} when you are ready`)),
    );
  } else {
    const again = formatHelpEntry("sheet validate", commandIds.sheetCommandId);
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.error} Sheet Needs Fixes\n-# Nothing was registered`),
          textBlock([`${facts} · **Failed checks** \`${issueCount}\``, ...staffNote].join("\n")),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(`-# Fix the Google Sheet and run ${again} again`)),
    );
  }

  for (const bucket of report.buckets) {
    const copy = ISSUE_COPY[bucket.kind];
    const tagHint =
      bucket.kind === "tag"
        ? `\n${formatHelpEntry("utility discord tag", commandIds.utilityCommandId)} turns Discord IDs into usernames in sheet order.`
        : "";
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(
          textBlock(`### ${emojis.error} ${copy.title} · ${bucket.lines.length}\n-# ${copy.body}${tagHint}`),
          textBlock(clipLines(bucket.lines)),
        ),
    );
  }

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: containers,
  };
}
