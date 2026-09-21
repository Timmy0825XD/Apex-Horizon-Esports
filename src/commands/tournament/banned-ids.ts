import { playerSlotLabel } from "./fields.js";
import {
  SheetError,
  fetchSheetCsv,
  parseCsv,
  type ParsedSheet,
  type SheetPlayer,
} from "./sheet.js";

export const OFFICIAL_BANNED_IDS_SHEET =
  "https://docs.google.com/spreadsheets/d/17Xv8rF_UmKslmd_MBGiBf610xb2YleQJHivoc-6JqYU/edit?usp=sharing";

export type BannedPlayerHit = {
  teamName: string;
  slotLabel: string;
  gameName: string;
  gameId: string;
  discordId: string;
  discordTag: string;
};

export function normalizeGameId(value: string): string {
  return value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}

function isComparableGameId(value: string): boolean {
  const normalized = normalizeGameId(value);
  return normalized.length >= 8 && normalized.length <= 16 && /[A-F]/.test(normalized);
}

export async function loadOfficialBannedGameIds(): Promise<Set<string>> {
  let csv: string;
  try {
    csv = await fetchSheetCsv(OFFICIAL_BANNED_IDS_SHEET);
  } catch (error) {
    if (error instanceof SheetError) {
      throw new SheetError(
        error.code,
        "The official banned-ID list could not be read. Share it as **Anyone with the link can view** and try again.",
      );
    }
    throw error;
  }

  const ids = new Set<string>();
  for (const [index, row] of parseCsv(csv).entries()) {
    const raw = row[0]?.trim() ?? "";
    if (!raw) {
      continue;
    }
    if (index === 0 && /game\s*id/i.test(raw)) {
      continue;
    }
    if (!isComparableGameId(raw)) {
      continue;
    }
    ids.add(normalizeGameId(raw));
  }

  if (ids.size === 0) {
    throw new SheetError("sheet-empty", "The official banned-ID list is empty. Cannot register a tournament until it is readable.");
  }

  return ids;
}

function extractGameIds(value: string): string[] {
  const tokens: string[] = value.toUpperCase().match(/[0-9A-F]{15,16}/g) ?? [];
  const whole = normalizeGameId(value);
  if (isComparableGameId(value) && !tokens.includes(whole)) {
    tokens.push(whole);
  }
  return [...new Set(tokens)];
}

function playerCandidates(player: SheetPlayer): string[] {
  return [player.gameId, player.currentTitle, player.gameName, player.discordTag, player.discordId];
}

export function playerHasOfficialBannedId(player: SheetPlayer, banned: Set<string>): boolean {
  return playerCandidates(player).some((value) => extractGameIds(value).some((id) => banned.has(id)));
}

export async function findBannedPlayers(sheet: ParsedSheet): Promise<BannedPlayerHit[]> {
  const banned = await loadOfficialBannedGameIds();
  const hits: BannedPlayerHit[] = [];
  const seen = new Set<string>();

  for (const team of sheet.teams) {
    for (const player of team.players) {
      const matched = playerCandidates(player).find((value) => extractGameIds(value).some((id) => banned.has(id)));
      if (!matched) {
        continue;
      }
      const id = extractGameIds(matched).find((token) => banned.has(token)) ?? normalizeGameId(matched);
      const key = `${team.teamName}:${player.slot}:${id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      hits.push({
        teamName: team.teamName,
        slotLabel: playerSlotLabel(player.slot),
        gameName: player.gameName,
        gameId: player.gameId.trim() || matched.trim(),
        discordId: player.discordId.trim(),
        discordTag: player.discordTag.trim(),
      });
    }

    for (const extra of team.extra) {
      const id = extractGameIds(extra.value).find((token) => banned.has(token));
      if (!id) {
        continue;
      }
      const key = `${team.teamName}:extra:${id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const captain = team.players[0];
      hits.push({
        teamName: team.teamName,
        slotLabel: extra.header || "Extra",
        gameName: captain?.gameName ?? "",
        gameId: extra.value.trim(),
        discordId: captain?.discordId.trim() ?? "",
        discordTag: captain?.discordTag.trim() ?? "",
      });
    }
  }

  return hits;
}
