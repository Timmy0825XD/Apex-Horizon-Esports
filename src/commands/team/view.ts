import {
  ContainerBuilder,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import {
  hasLeadingTeamName,
  type ExtraField,
  type SheetPlayer,
  type SheetTeam,
  type TeamFormat,
} from "../../lib/sheet.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import type { TeamTournament } from "./store.js";

export const MAX_INFO_HITS = 5;

export function teamErrorMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
  };
}

function extraLines(extra: ExtraField[]): string[] {
  return extra.map((field) => {
    if (!field.value) {
      return `> **${field.header}:** *Empty*`;
    }
    return `> **${field.header}:** **${field.value}**`;
  });
}

function displayTitle(team: SheetTeam, format: TeamFormat, matched: SheetPlayer[]): string {
  if (hasLeadingTeamName(format) && team.teamName) {
    return team.teamName;
  }
  const player = matched[0] ?? team.players[0];
  return player?.discordTag || player?.gameName || player?.gameId || "Team";
}

export type PlayerPresence = {
  avatarUrl?: string;
  inServer: boolean;
  validId: boolean;
  verified: boolean;
  banned: boolean;
};

export type TeamHit = {
  team: SheetTeam;
  matched: SheetPlayer[];
  matchBy: string;
};

function snowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function detailsHeading(slot: number): string {
  return slot === 0 ? "Captain details" : `Player ${slot + 1} details`;
}

function verificationLine(player: SheetPlayer, presence: PlayerPresence | undefined): string {
  const label = `Verification`;
  if (!player.discordId) {
    return `> **${label}:** *No Discord ID*`;
  }
  if (!snowflake(player.discordId) || presence?.validId === false) {
    return `> **${label}:** ${emojis.error} Invalid Discord ID`;
  }
  if (presence?.banned) {
    return `> **${label}:** ${emojis.banned} Banned`;
  }
  if (presence?.inServer && presence.verified) {
    return `> **${label}:** ${emojis.success} In server`;
  }
  if (presence?.inServer) {
    return `> **${label}:** ${emojis.error} Not verified`;
  }
  return `> **${label}:** ${emojis.error} Not in server`;
}

function formatCurrentTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "*Empty*";
  }
  const key = trimmed.toLowerCase();
  const mark = key.includes("legend") ? emojis.legend : key.includes("hero") ? emojis.hero : "";
  return mark ? `${mark} **${trimmed}**` : `**${trimmed}**`;
}

function playerDetailLines(player: SheetPlayer, presence: PlayerPresence | undefined): string {
  const tag = player.discordTag ? `**${player.discordTag}**` : "*Empty*";
  const discordId = player.discordId ? `\`${player.discordId}\`` : "*Empty*";
  const gameName = player.gameName ? `**${player.gameName}**` : "*Empty*";
  const gameId = player.gameId ? `\`${player.gameId}\`` : "*Empty*";
  const title = formatCurrentTitle(player.currentTitle);
  return [
    `> **Discord Tag:** ${tag}`,
    `> **Discord ID:** ${discordId}`,
    `> **Game Name:** ${gameName}`,
    `> **Game ID:** ${gameId}`,
    `> **Title:** ${title}`,
    verificationLine(player, presence),
  ].join("\n");
}

function playerHasData(player: SheetPlayer): boolean {
  return Boolean(player.discordTag || player.discordId || player.gameName || player.gameId || player.currentTitle);
}

function addPlayerSection(
  container: ContainerBuilder,
  player: SheetPlayer,
  presence: PlayerPresence | undefined,
): void {
  const heading = `### ${emojis.captains} ${detailsHeading(player.slot)}`;
  const body = playerDetailLines(player, presence);
  if (presence?.avatarUrl) {
    container.addSectionComponents(headingWithThumbnail(heading, presence.avatarUrl, body));
    return;
  }
  container.addTextDisplayComponents(textBlock(`${heading}\n${body}`));
}

export function teamCardMessage(input: {
  tournament: TeamTournament;
  format: TeamFormat;
  team: SheetTeam;
  presence: Map<string, PlayerPresence>;
  requestedBy: string;
  matchBy?: string;
  position?: { index: number; total: number };
}): InteractionReplyOptions {
  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [buildTeamCard(input)],
  };
}

function buildTeamCard(input: {
  tournament: TeamTournament;
  format: TeamFormat;
  team: SheetTeam;
  presence: Map<string, PlayerPresence>;
  requestedBy: string;
  matchBy?: string;
  position?: { index: number; total: number };
}): ContainerBuilder {
  const title = displayTitle(input.team, input.format, input.team.players);
  const identity = [
    `${emojis.torneo} **Tournament name:** **${input.tournament.name}**`,
    input.matchBy ? `${emojis.matchBy} **Matched by:** ${input.matchBy}` : "",
    input.position && input.position.total > 1
      ? `*Team **${input.position.index}** of **${input.position.total}***`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.info)
    .addTextDisplayComponents(textBlock(`# ${emojis.humans} **${title}**`), textBlock(identity));

  const players = input.team.players.filter(playerHasData);
  if (players.length > 0) {
    container.addSeparatorComponents(divider());
  }
  for (const [playerIndex, player] of players.entries()) {
    if (playerIndex > 0 && players.length <= 3 && input.team.extra.length === 0) {
      container.addSeparatorComponents(divider());
    }
    addPlayerSection(container, player, input.presence.get(player.discordId));
  }

  if (input.team.extra.length > 0) {
    container.addTextDisplayComponents(textBlock(`## Extra columns\n${extraLines(input.team.extra).join("\n")}`));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(input.requestedBy)}`));

  return container;
}

export function teamInfoMessages(input: {
  tournament: TeamTournament;
  format: TeamFormat;
  hits: TeamHit[];
  presence: Map<string, PlayerPresence>;
  requestedBy: string;
}): InteractionReplyOptions {
  const { tournament, format, hits, presence, requestedBy } = input;

  if (hits.length === 0) {
    return {
      flags: v2Flags,
      allowedMentions: { parse: [] },
      components: [
        new ContainerBuilder()
          .setAccentColor(embedColors.error)
          .addTextDisplayComponents(
            textBlock(`# ${emojis.error} No player matched`),
            textBlock(`Nobody in **${tournament.name}** matched that Discord user or alias. Try the other field.`),
          )
          .addSeparatorComponents(divider())
          .addTextDisplayComponents(textBlock(`-# Requested by ${formatUser(requestedBy)}`)),
      ],
    };
  }

  const shown = hits.slice(0, MAX_INFO_HITS);
  const extraHits = hits.length - shown.length;
  const containers = shown.map((hit, index) =>
    buildTeamCard({
      tournament,
      format,
      team: hit.team,
      presence,
      requestedBy,
      matchBy: hit.matchBy,
      position: hits.length > 1 ? { index: index + 1, total: hits.length } : undefined,
    }),
  );

  if (extraHits > 0) {
    containers.push(
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.next} More matches`),
          textBlock(
            `**${extraHits}** more team${extraHits === 1 ? "" : "s"} matched in **${tournament.name}**. Narrow the search with a Discord user or a full in-game ID.`,
          ),
        ),
    );
  }

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: containers,
  };
}

