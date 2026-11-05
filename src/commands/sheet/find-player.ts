import type { ChatInputCommandInteraction } from "discord.js";
import type { SheetPlayer, SheetTeam } from "../../lib/sheet.js";
import { listStoredSheets, type StoredSheetRecord } from "../tournament/store.js";
import { actorMatches } from "../../lib/command-access.js";
import { deferSheet, respondSheet } from "./respond.js";
import { playerFoundMessages, sheetErrorMessage, type PlayerHit } from "./view.js";

type Query = {
  /** Already normalized. */
  gameIds: string[];
  discordIds: string[];
  discordTag?: string;
  playerName?: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Several IDs go in one field separated by spaces; repeats are dropped. */
export function splitIds(raw: string | null | undefined, normalizeEach = false): string[] {
  const ids = (raw ?? "").split(/\s+/).filter(Boolean);
  return [...new Set(normalizeEach ? ids.map(normalize) : ids)];
}

export function playerMatches(player: SheetPlayer, query: Query): boolean {
  const checks: boolean[] = [];
  if (query.discordIds.length > 0) {
    checks.push(query.discordIds.includes(player.discordId));
  }
  if (query.gameIds.length > 0) {
    checks.push(query.gameIds.includes(normalize(player.gameId)));
  }
  if (query.discordTag) {
    checks.push(normalize(player.discordTag).includes(normalize(query.discordTag)));
  }
  if (query.playerName) {
    checks.push(normalize(player.gameName).includes(normalize(query.playerName)));
  }
  return checks.some(Boolean);
}

function identityKey(player: SheetPlayer): string {
  if (player.discordId) {
    return `d:${player.discordId}`;
  }
  if (player.gameId) {
    return `g:${normalize(player.gameId)}`;
  }
  if (player.discordTag) {
    return `t:${normalize(player.discordTag)}`;
  }
  return `n:${normalize(player.gameName)}`;
}

function displayName(player: SheetPlayer): string {
  return player.gameName || player.discordTag || player.discordId || player.gameId || "Unknown player";
}

function captainOf(team: SheetTeam): SheetPlayer {
  return team.players.find((player) => player.slot === 0) ?? team.players[0] ?? {
    slot: 0,
    discordTag: "",
    discordId: "",
    gameName: "",
    gameId: "",
    currentTitle: "",
  };
}

function mergeKeys(player: SheetPlayer): string[] {
  const keys = [identityKey(player)];
  if (player.discordId) {
    keys.push(`d:${player.discordId}`);
  }
  if (player.gameId) {
    keys.push(`g:${normalize(player.gameId)}`);
  }
  return [...new Set(keys)];
}

type OpenHit = {
  keys: Set<string>;
  displayName: string;
  teamName: string;
  format: StoredSheetRecord["format"];
  captain: SheetPlayer;
  headers: string[];
  sheets: Map<string, StoredSheetRecord>;
};

export async function handleSheetFindPlayer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondSheet(interaction, sheetErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  if (!(await actorMatches(interaction, { admin: true, organiser: true }))) {
    await respondSheet(
      interaction,
      sheetErrorMessage("Admin or organiser required", "You need **Admin** or **Organiser** to search stored sheets."),
    );
    return;
  }

  const query: Query = {
    gameIds: splitIds(interaction.options.getString("game_id"), true),
    discordIds: splitIds(interaction.options.getString("discord_id")),
    discordTag: interaction.options.getString("discord_tag")?.trim() || undefined,
    playerName: interaction.options.getString("player_name")?.trim() || undefined,
  };

  if (query.gameIds.length === 0 && query.discordIds.length === 0 && !query.discordTag && !query.playerName) {
    await respondSheet(
      interaction,
      sheetErrorMessage(
        "Need a search field",
        "Fill in at least one of **game ID**, **Discord ID**, **Discord tag**, or **player name**. Several fields use **OR**.",
      ),
    );
    return;
  }

  await deferSheet(interaction, true);

  const sheets = (await listStoredSheets()).map((sheet) => ({
    ...sheet,
    guildName: interaction.client.guilds.cache.get(sheet.guildId)?.name ?? (sheet.guildName || "Unknown server"),
  }));
  const open: OpenHit[] = [];

  for (const sheet of sheets) {
    for (const team of sheet.teams) {
      for (const player of team.players) {
        if (!playerMatches(player, query)) {
          continue;
        }

        const keys = mergeKeys(player);
        let group = open.find((hit) => keys.some((key) => hit.keys.has(key)));
        if (!group) {
          group = {
            keys: new Set(keys),
            displayName: displayName(player),
            teamName: team.teamName,
            format: sheet.format,
            captain: captainOf(team),
            headers: sheet.headers,
            sheets: new Map(),
          };
          open.push(group);
        } else {
          for (const key of keys) {
            group.keys.add(key);
          }
        }
        group.sheets.set(sheet.id, sheet);
      }
    }
  }

  const hits: PlayerHit[] = open.map((hit) => ({
    identity: [...hit.keys][0] ?? hit.displayName,
    displayName: hit.displayName,
    teamName: hit.teamName,
    format: hit.format,
    captain: hit.captain,
    headers: hit.headers,
    sheets: [...hit.sheets.values()],
  }));

  const [first, ...rest] = playerFoundMessages(hits);
  await respondSheet(interaction, first);
  // One by one keeps the order; each message is already packed to Discord's limits.
  for (const message of rest) {
    await interaction.followUp(message);
  }
}
