import type { ChatInputCommandInteraction } from "discord.js";
import { deferTournament, respondTournament } from "./respond.js";
import { listStoredSheets, type StoredSheetRecord } from "./store.js";
import type { SheetPlayer, SheetTeam } from "./sheet.js";
import { playerFoundMessages, tournamentErrorMessage, type PlayerHit } from "./view.js";

type Query = {
  gameId?: string;
  discordId?: string;
  discordTag?: string;
  playerName?: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function playerMatches(player: SheetPlayer, query: Query): boolean {
  const checks: boolean[] = [];
  if (query.discordId) {
    checks.push(player.discordId === query.discordId);
  }
  if (query.gameId) {
    checks.push(normalize(player.gameId) === normalize(query.gameId));
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

export async function handleTournamentFindPlayer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTournament(interaction, tournamentErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  const query: Query = {
    gameId: interaction.options.getString("game_id")?.trim() || undefined,
    discordId: interaction.options.getString("discord_id")?.trim() || undefined,
    discordTag: interaction.options.getString("discord_tag")?.trim() || undefined,
    playerName: interaction.options.getString("player_name")?.trim() || undefined,
  };

  if (!query.gameId && !query.discordId && !query.discordTag && !query.playerName) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Need a search field",
        "Fill in at least one of **game ID**, **Discord ID**, **Discord tag**, or **player name**. Several fields use **OR**.",
      ),
    );
    return;
  }

  await deferTournament(interaction, true);

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

  await respondTournament(interaction, playerFoundMessages(hits));
}
