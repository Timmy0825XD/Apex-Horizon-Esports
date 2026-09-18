import { type ChatInputCommandInteraction, type User } from "discord.js";
import { loadParsedSheet, playerSlotLabel, type SheetPlayer, type SheetTeam } from "../../lib/sheet.js";
import { rosterLoadError } from "./errors.js";
import { resolvePresence } from "./presence.js";
import { deferTeam, respondTeam } from "./respond.js";
import { findGuildTournament } from "./store.js";
import { MAX_INFO_HITS, teamErrorMessage, teamInfoMessages, type TeamHit } from "./view.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeGameId(value: string): string {
  return value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function parseDiscordId(value: string): string | null {
  const mention = value.trim().match(/^<@!?(\d{17,20})>$/);
  if (mention?.[1]) {
    return mention[1];
  }
  const trimmed = value.trim();
  return isSnowflake(trimmed) ? trimmed : null;
}

type AliasQuery =
  | { type: "discordId"; id: string }
  | { type: "gameId"; id: string }
  | { type: "name"; exact: string };

function classifyAlias(raw: string): AliasQuery {
  const discordId = parseDiscordId(raw);
  if (discordId) {
    return { type: "discordId", id: discordId };
  }

  const gameId = normalizeGameId(raw);
  if (gameId.length >= 8 && gameId.length <= 16) {
    return { type: "gameId", id: gameId };
  }

  return { type: "name", exact: normalize(raw) };
}

function playerMatchesUser(player: SheetPlayer, user: User): boolean {
  return Boolean(player.discordId) && player.discordId === user.id;
}

function playerMatchesAlias(player: SheetPlayer, alias: AliasQuery, allowNameContains: boolean): boolean {
  if (alias.type === "discordId") {
    return player.discordId === alias.id;
  }
  if (alias.type === "gameId") {
    return Boolean(player.gameId) && normalizeGameId(player.gameId) === alias.id;
  }
  if (!player.gameName) {
    return false;
  }
  const name = normalize(player.gameName);
  if (name === alias.exact) {
    return true;
  }
  return allowNameContains && alias.exact.length >= 3 && name.includes(alias.exact);
}

function matchByLabel(player: SheetPlayer, field: string): string {
  return `${playerSlotLabel(player.slot)} ${field}`;
}

function aliasMatchBy(player: SheetPlayer, alias: AliasQuery): string {
  if (alias.type === "discordId") {
    return matchByLabel(player, "Discord ID");
  }
  if (alias.type === "gameId") {
    return matchByLabel(player, "In-game ID");
  }
  return matchByLabel(player, "In-game name");
}

function collectHits(teams: SheetTeam[], user: User | null, alias: AliasQuery | undefined): TeamHit[] {
  const scan = (allowNameContains: boolean): TeamHit[] => {
    const hits: TeamHit[] = [];
    for (const team of teams) {
      const matched = team.players.filter((player) => {
        const userOk = !user || playerMatchesUser(player, user);
        const aliasOk = !alias || playerMatchesAlias(player, alias, allowNameContains);
        return userOk && aliasOk;
      });
      const first = matched[0];
      if (first) {
        hits.push({
          team,
          matched,
          matchBy: alias ? aliasMatchBy(first, alias) : matchByLabel(first, "Discord ID"),
        });
      }
    }
    return hits;
  };

  const exact = scan(false);
  if (exact.length > 0 || !alias || alias.type !== "name" || alias.exact.length < 3) {
    return exact;
  }
  return scan(true);
}

export async function handleTeamInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await respondTeam(interaction, teamErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  const user = interaction.options.getUser("user");
  const aliasRaw = interaction.options.getString("alias")?.trim() || undefined;
  if (!user && !aliasRaw) {
    await respondTeam(
      interaction,
      teamErrorMessage(
        "Need a search field",
        "Fill **user** or **alias**. Alias matches a **game ID**, **in-game name**, or **Discord ID**.",
      ),
    );
    return;
  }

  await deferTeam(interaction);

  const tournament = await findGuildTournament(guild.id, interaction.options.getString("tournament", true));
  if (!tournament) {
    await respondTeam(
      interaction,
      teamErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  try {
    const sheet = await loadParsedSheet(tournament.sheetLink);
    const alias = aliasRaw ? classifyAlias(aliasRaw) : undefined;
    const hits = collectHits(sheet.teams, user, alias);
    const presence = await resolvePresence(
      guild,
      hits.slice(0, MAX_INFO_HITS).map((hit) => hit.team),
    );
    await respondTeam(
      interaction,
      teamInfoMessages({
        tournament,
        format: sheet.format,
        hits,
        presence,
        requestedBy: interaction.user.id,
      }),
    );
  } catch (error) {
    await respondTeam(interaction, teamErrorMessage("Could not load participants", rosterLoadError(error), false));
  }
}
