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
  roleFields,
  textChannelFields,
  type TournamentRecord,
} from "./fields.js";
import type { DeletedRelated } from "./store.js";
import type { BannedPlayerHit } from "./banned-ids.js";

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
  const auto = tournament.autoRoomRunning ? "On" : "Off";

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
    note: "Only the values you changed were rewritten.",
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
    const auto = row.autoRoomRunning ? "auto-room on" : "auto-room off";
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
  const findPlayer = formatHelpEntry("sheet find_player", commandId);
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
