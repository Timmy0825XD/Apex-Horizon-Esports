export const TEAM_FORMATS = ["1vs1", "2vs2", "3vs3", "4vs4", "5vs5"] as const;

export type TeamFormat = (typeof TEAM_FORMATS)[number];

export const PLAYER_FIELDS = [
  { key: "discordTag", label: "Discord Tag" },
  { key: "discordId", label: "Discord ID" },
  { key: "gameName", label: "In-game name" },
  { key: "gameId", label: "In-game ID" },
  { key: "currentTitle", label: "Current Title" },
] as const;

export type PlayerFieldKey = (typeof PLAYER_FIELDS)[number]["key"];

export function isTeamFormat(value: string): value is TeamFormat {
  return (TEAM_FORMATS as readonly string[]).includes(value);
}

export function formatPlayerCount(format: TeamFormat): number {
  return Number(format[0]);
}

export function playerSlotLabel(slot: number): string {
  return slot === 0 ? "Captain" : `Player ${slot + 1}`;
}

export function hasLeadingTeamName(format: TeamFormat): boolean {
  return format !== "1vs1";
}

export function playerBlockStart(format: TeamFormat): number {
  return hasLeadingTeamName(format) ? 1 : 0;
}

export function coreColumnCount(format: TeamFormat): number {
  return playerBlockStart(format) + formatPlayerCount(format) * PLAYER_FIELDS.length;
}

export function detectSheetLayout(columnCount: number): { format: TeamFormat; additionalFieldCount: number } | null {
  if (columnCount < PLAYER_FIELDS.length) {
    return null;
  }
  for (let i = TEAM_FORMATS.length - 1; i >= 0; i -= 1) {
    const format = TEAM_FORMATS[i];
    if (!format) {
      continue;
    }
    const core = coreColumnCount(format);
    if (columnCount >= core) {
      return { format, additionalFieldCount: columnCount - core };
    }
  }
  return null;
}

export type DiscordIdHeader = {
  slot: number;
  label: string;
};

const DISCORD_ID_OFFSET = PLAYER_FIELDS.findIndex((field) => field.key === "discordId");

export function discordIdHeaders(format: TeamFormat, headers: string[] = []): DiscordIdHeader[] {
  const start = playerBlockStart(format);
  const offset = DISCORD_ID_OFFSET >= 0 ? DISCORD_ID_OFFSET : 1;
  const count = formatPlayerCount(format);
  const listed: DiscordIdHeader[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const index = start + slot * PLAYER_FIELDS.length + offset;
    const fallback = `${playerSlotLabel(slot)} ${PLAYER_FIELDS[offset]?.label ?? "Discord ID"}`;
    listed.push({ slot, label: headers[index]?.trim() || fallback });
  }
  return listed;
}

export function canonicalHeaders(format: TeamFormat): string[] {
  const headers: string[] = [];
  if (hasLeadingTeamName(format)) {
    headers.push("Team name");
  }
  const players = formatPlayerCount(format);
  for (let slot = 0; slot < players; slot += 1) {
    const prefix = playerSlotLabel(slot);
    for (const field of PLAYER_FIELDS) {
      headers.push(`${prefix} ${field.label}`);
    }
  }
  return headers;
}

export type SheetPlayer = {
  slot: number;
  discordTag: string;
  discordId: string;
  gameName: string;
  gameId: string;
  currentTitle: string;
};

export type ExtraField = {
  header: string;
  value: string;
};

export type SheetTeam = {
  teamName: string;
  players: SheetPlayer[];
  extra: ExtraField[];
};

export type ParsedSheet = {
  format: TeamFormat;
  additionalFieldCount: number;
  headers: string[];
  teams: SheetTeam[];
};

export class SheetError extends Error {
  constructor(
    readonly code: "invalid-link" | "sheet-private" | "sheet-empty" | "bad-columns" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "SheetError";
  }
}

function looksLikeHtml(text: string): boolean {
  const start = text.slice(0, 200).toLowerCase();
  return start.includes("<html") || start.includes("<!doctype");
}

export function parseSheetUrl(link: string): { spreadsheetId: string; gid: string } | null {
  const trimmed = link.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch?.[1]) {
    return null;
  }
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  return { spreadsheetId: idMatch[1], gid: gidMatch?.[1] ?? "0" };
}

export function parseCsv(text: string, delimiter = ","): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }
      cell += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function detectCsvDelimiter(text: string): string {
  const candidates = [",", ";", "\t"] as const;
  let best: (typeof candidates)[number] = ",";
  let bestScore = -1;
  for (const delimiter of candidates) {
    const rows = parseCsv(text, delimiter);
    let score = 0;
    for (const row of rows) {
      if ((row[0]?.trim() ?? "") && (row[1]?.trim() ?? "")) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

function cellValue(row: string[], index: number): string {
  return row[index]?.trim() ?? "";
}

function trailingEmptyCount(row: string[]): number {
  let empty = 0;
  for (let i = row.length - 1; i >= 0; i -= 1) {
    if (row[i]?.trim()) {
      break;
    }
    empty += 1;
  }
  return empty;
}

function parsePlayer(row: string[], start: number, slot: number): SheetPlayer {
  return {
    slot,
    discordTag: cellValue(row, start),
    discordId: cellValue(row, start + 1),
    gameName: cellValue(row, start + 2),
    gameId: cellValue(row, start + 3),
    currentTitle: cellValue(row, start + 4),
  };
}

function parseExtra(row: string[], headers: string[], core: number, extraCount: number): ExtraField[] {
  const extra: ExtraField[] = [];
  for (let i = 0; i < extraCount; i += 1) {
    const index = core + i;
    extra.push({
      header: headers[index] || `Extra ${i + 1}`,
      value: cellValue(row, index),
    });
  }
  return extra;
}

function parseTeam(row: string[], format: TeamFormat, headers: string[], extraCount: number): SheetTeam | null {
  const start = playerBlockStart(format);
  const players: SheetPlayer[] = [];
  const slots = formatPlayerCount(format);
  for (let slot = 0; slot < slots; slot += 1) {
    players.push(parsePlayer(row, start + slot * PLAYER_FIELDS.length, slot));
  }

  const captain = players[0];
  if (!captain || (!captain.discordTag && !captain.discordId && !captain.gameName && !captain.gameId)) {
    return null;
  }

  const extra = parseExtra(row, headers, coreColumnCount(format), extraCount);
  const coreEnd = coreColumnCount(format) + extraCount;
  for (let i = coreEnd; i < row.length; i += 1) {
    const value = cellValue(row, i);
    if (value) {
      extra.push({
        header: headers[i] || `Column ${i + 1}`,
        value,
      });
    }
  }

  return {
    teamName: format === "1vs1" ? captain.discordTag : cellValue(row, 0),
    players,
    extra,
  };
}

export function parseSheetRows(rows: string[][]): ParsedSheet {
  const filled = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (filled.length === 0) {
    throw new SheetError("sheet-empty", "The Google Sheet is empty.");
  }

  const headerSource = filled[0] ?? [];
  const columnCount = headerSource.length - trailingEmptyCount(headerSource);
  const layout = detectSheetLayout(columnCount);
  if (!layout) {
    throw new SheetError(
      "bad-columns",
      `The sheet needs a player block (5 columns each: tag, Discord ID, in-game name, in-game ID, current title). 2vs2 / 3vs3 / 4vs4 / 5vs5 also start with a team-name column. Found **${columnCount}** filled header columns.`,
    );
  }

  const { format, additionalFieldCount } = layout;
  const total = coreColumnCount(format) + additionalFieldCount;
  const headers = (filled[0] ?? []).slice(0, total).map((cell, index) => cell.trim() || `Column ${index + 1}`);
  const teams: SheetTeam[] = [];
  for (const row of filled.slice(1)) {
    const team = parseTeam(row, format, headers, additionalFieldCount);
    if (team) {
      teams.push(team);
    }
  }

  if (teams.length === 0) {
    throw new SheetError("sheet-empty", "The Google Sheet has headers but no participant rows.");
  }

  return { format, additionalFieldCount, headers, teams };
}

function headerLooksMashed(text: string): boolean {
  const header = parseCsv(text)[0] ?? [];
  return header.some((cell) => cell.trim().length > 80);
}

function csvScore(text: string): number {
  if (!text.trim() || looksLikeHtml(text)) {
    return -1;
  }
  const rows = parseCsv(text);
  const filled = rows.filter((row) => row.some((cell) => cell.trim())).length;
  if (filled === 0) {
    return -1;
  }
  return headerLooksMashed(text) ? filled : filled + 10_000;
}

export async function fetchSheetCsv(link: string): Promise<string> {
  const parsed = parseSheetUrl(link);
  if (!parsed) {
    throw new SheetError(
      "invalid-link",
      "That does not look like a Google Sheet URL. Paste the full `docs.google.com/spreadsheets` link.",
    );
  }

  const urls = [
    `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/export?format=csv&gid=${parsed.gid}`,
    `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/gviz/tq?tqx=out:csv&gid=${parsed.gid}&headers=1`,
    `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/gviz/tq?tqx=out:csv&gid=${parsed.gid}`,
  ];

  let best: { text: string; score: number } | null = null;
  let lastHtml = false;
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "ApexHorizonEsportsBot/0.1" },
      });
      const text = await response.text();
      if (!response.ok || looksLikeHtml(text)) {
        lastHtml = true;
        continue;
      }
      const score = csvScore(text);
      if (score > (best?.score ?? -1)) {
        best = { text, score };
      }
      if (score >= 10_002) {
        break;
      }
    } catch (error) {
      if (error instanceof SheetError) {
        throw error;
      }
      lastHtml = false;
    } finally {
      clearTimeout(timer);
    }
  }

  if (best && best.score >= 10_000) {
    return best.text;
  }
  if (best) {
    throw new SheetError(
      "bad-columns",
      "The bot could not read that Google Sheet as one row per team (Tables often break the default export). Share it as **Anyone with the link can view** without Table formatting, or copy the range to a normal sheet.",
    );
  }
  if (lastHtml) {
    throw new SheetError(
      "sheet-private",
      "The bot could not read that sheet. Share it as **Anyone with the link can view** and try again.",
    );
  }
  throw new SheetError("timeout", "Timed out reading the Google Sheet. Check the link and try again.");
}

export async function loadParsedSheet(link: string): Promise<ParsedSheet> {
  const csv = await fetchSheetCsv(link);
  return parseSheetRows(parseCsv(csv));
}
