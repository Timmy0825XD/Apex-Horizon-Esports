import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { escapeDiscord } from "../room/labels.js";
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
  roleFields,
  textChannelFields,
  type TournamentRecord,
} from "./fields.js";
import type { DeletedRelated } from "./store.js";
import type { BannedPlayerHit } from "./banned-ids.js";
import { slashMention } from "../../lib/register-slash.js";

export type TournamentPanelKind = "add" | "edit" | "info";

type Entity = "role" | "channel" | "category";

function stamp(): string {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

function exists(guild: Guild, kind: Entity, id: string): boolean {
  return kind === "role" ? guild.roles.cache.has(id) : guild.channels.cache.has(id);
}

function entry(guild: Guild, kind: Entity, id: string, label: string, updated: boolean): string {
  const mention = kind === "role" ? formatRole(guild, id) : kind === "category" ? formatCategory(guild, id) : formatChannel(guild, id);
  const tag = updated ? " · *updated*" : "";
  if (exists(guild, kind, id)) {
    return `**${label}** ${mention}${tag}`;
  }
  return `${emojis.error} **${label}** ${mention}${tag} · *missing from this server*`;
}

/** Entries that fit on one line share it; a missing or updated one gets its own line so the tag stays readable. */
function joinEntries(entries: string[], perLine: number): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  for (const item of entries) {
    if (item.includes("*missing") || item.includes("*updated*")) {
      if (current.length > 0) {
        lines.push(current.join(" · "));
        current = [];
      }
      lines.push(item);
      continue;
    }
    current.push(item);
    if (current.length === perLine) {
      lines.push(current.join(" · "));
      current = [];
    }
  }
  if (current.length > 0) {
    lines.push(current.join(" · "));
  }
  return lines;
}

const shortRole: Record<string, string> = { adminRoleId: "Admin", helperRoleId: "Helper" };
const shortChannel: Record<string, string> = {
  attendanceChannelId: "Attendance",
  transcriptChannelId: "Transcripts",
  rulesChannelId: "Rules",
  deadlineChannelId: "Deadlines",
  resultChannelId: "Results",
  eventsLinksChannelId: "Events Links",
};

function worldSections(guild: Guild, tournament: TournamentRecord, changed: Set<string>): { roles: string; channels: string; tickets: string; missing: number } {
  const roles = roleFields.map((field) =>
    entry(guild, "role", tournament[field.key], shortRole[field.key] ?? field.label, changed.has(field.key)),
  );
  const channels = [
    ...textChannelFields.map((field) =>
      entry(guild, "channel", tournament[field.key], shortChannel[field.key] ?? field.label, changed.has(field.key)),
    ),
    ...optionalTextChannelFields.flatMap((field) => {
      const id = tournament[field.key];
      return id ? [entry(guild, "channel", id, shortChannel[field.key] ?? field.label, changed.has(field.key))] : [];
    }),
  ];
  const openChanged = changed.has("ticketOpenCategoryIds");
  const tickets = [
    entry(guild, "category", tournament.closedTicketCategoryId, "Closed", changed.has("closedTicketCategoryId")),
    ...(tournament.closeTicketCategory2Id
      ? [entry(guild, "category", tournament.closeTicketCategory2Id, "Closed 2", changed.has("closeTicketCategory2Id"))]
      : []),
    ...tournament.ticketOpenCategoryIds.flatMap((id, index) =>
      id ? [entry(guild, "category", id, `Open ${index + 1}`, openChanged)] : [],
    ),
  ];
  const missing = [...roles, ...channels, ...tickets].filter((line) => line.includes("*missing")).length;
  return {
    roles: [`### ${emojis.gem} Roles`, ...joinEntries(roles, 2)].join("\n"),
    channels: [`### ${emojis.textChannel} Channels`, ...joinEntries(channels, 2)].join("\n"),
    tickets: [`### ${emojis.categories} Ticket Categories`, ...tickets].join("\n"),
    missing,
  };
}

function sheetRow(sheetLink: string): ActionRowBuilder<ButtonBuilder> | null {
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

export function tournamentWorldMessage(input: {
  kind: TournamentPanelKind;
  guild: Guild;
  tournament: TournamentRecord;
  commandId?: string;
  thumbnailUrl?: string;
  /** Keys `edit` rewrote; they get an *updated* tag. */
  changed?: readonly string[];
  keyChanged?: boolean;
  actorId: string;
}): InteractionReplyOptions {
  const { kind, guild, tournament } = input;
  const changed = new Set<string>(input.changed ?? []);
  const tag = (key: string) => (changed.has(key) ? " *(updated)*" : "");
  const name = escapeDiscord(tournament.name);
  const count = (input.changed?.length ?? 0) + (input.keyChanged ? 1 : 0);
  const heading =
    kind === "info"
      ? `## ${emojis.torneo} ${name}\n-# Bracket ${escapeDiscord(tournament.challongeId)}`
      : kind === "add"
        ? `## ${emojis.success} Tournament Registered\nSheet copied and bracket linked. Rooms and tickets will use these channels.`
        : `## ${emojis.success} Tournament Updated\n\`${count}\` ${count === 1 ? "value" : "values"} changed. The rest stayed as they were.`;
  const identity = [
    ...(kind === "info" ? [] : [`${emojis.torneo} **${name}**${tag("name")} · bracket \`${escapeDiscord(tournament.challongeId)}\``]),
    [
      `\`${tournament.format}\`${tag("format")}`,
      `\`${tournament.additionalFieldCount}\` extra ${tournament.additionalFieldCount === 1 ? "column" : "columns"}${tag("additionalFieldCount")}`,
      `auto-room **${tournament.autoRoomRunning ? "On" : "Off"}**`,
      `API key stored encrypted${input.keyChanged ? " *(updated)*" : ""}`,
    ].join(" · "),
    ...(changed.has("sheetLink") ? [`${emojis.link} Sheet link *updated*`] : []),
  ].join("\n");
  const sections = worldSections(guild, tournament, changed);

  const container = new ContainerBuilder().setAccentColor(kind === "info" ? embedColors.info : embedColors.success);
  if (input.thumbnailUrl && kind !== "info") {
    container.addSectionComponents(headingWithThumbnail(heading, input.thumbnailUrl, identity));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(identity));
  }
  if (sections.missing > 0) {
    container.addTextDisplayComponents(
      textBlock(
        `${emojis.alert} **${sections.missing}** ${sections.missing === 1 ? "value points" : "values point"} to something that is no longer in this server.`,
      ),
    );
  }
  const sheet = sheetRow(tournament.sheetLink);
  if (sheet) {
    container.addActionRowComponents(sheet);
  }

  const edit = formatHelpEntry("tournament edit", input.commandId);
  const footer =
    kind === "info"
      ? `-# ${tournament.createdBy ? `Created by ${formatUser(tournament.createdBy)} · ` : ""}change it with ${edit}`
      : `-# ${kind === "add" ? "Registered" : "Updated"} by ${formatUser(input.actorId)} · ${stamp()}`;
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(sections.roles), textBlock(sections.channels), textBlock(sections.tickets))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(footer));

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

export function tournamentListMessage(tournaments: TournamentRecord[], guildId: string | null): InteractionReplyOptions {
  if (tournaments.length === 0) {
    return {
      flags: [...v2Flags, MessageFlags.Ephemeral],
      components: [
        new ContainerBuilder()
          .setAccentColor(embedColors.info)
          .addTextDisplayComponents(
            textBlock(`## ${emojis.info} No Tournaments Yet`),
            textBlock(`This server has no operable tournaments. An **Admin** can register one with ${slashMention(guildId, "tournament add")}.`),
          ),
      ],
    };
  }

  const lines = tournaments.map(
    (row, index) =>
      `**${index + 1}.** ${emojis.torneo} **${escapeDiscord(row.name)}** · \`${row.format}\` · auto-room **${row.autoRoomRunning ? "On" : "Off"}**\n-# Bracket ${escapeDiscord(row.challongeId)}`,
  );

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.server} Tournaments\n\`${tournaments.length}\` of \`4\` slots used`),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(lines.join("\n")))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(`-# Details with ${slashMention(guildId, "tournament info")}`)),
    ],
  };
}

export function tournamentDeletedMessage(
  name: string,
  related: DeletedRelated,
  actorId: string,
  commandId?: string,
): InteractionReplyOptions {
  const findPlayer = formatHelpEntry("sheet find player", commandId);
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.error)
    .addTextDisplayComponents(
      textBlock(`## ${emojis.error} Tournament Removed\n**${escapeDiscord(name)}** is no longer operable here. Auto-room is off.`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `${emojis.mongo} **Cleared** \`${related.matches}\` matches · \`${related.rooms}\` rooms · \`${related.schedules}\` schedules · \`${related.attendances}\` attendance`,
          `${emojis.info} **Left in place** Discord channels · Google Sheet · Challonge bracket · the sheet stays in the historical archive`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# Removed by ${formatUser(actorId)} · ${stamp()} · search the archive with ${findPlayer}`),
    );

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [container],
  };
}
