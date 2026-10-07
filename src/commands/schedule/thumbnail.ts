import { readFileSync } from "node:fs";
import path from "node:path";
import type { Guild } from "discord.js";
import type { Match } from "@prisma/client";
import opentype from "opentype.js";
import sharp from "sharp";
import type { TournamentRecord } from "../tournament/fields.js";
import { backgroundPath } from "./backgrounds.js";
import { resolveStage } from "./stage.js";

const WIDTH = 1280;
const HEIGHT = 720;
const ICON_SIZE = 104;
const ICON_TOP = 40;
const TEAM_MAX_WIDTH = 400;
const FONT = "DejaVu Sans, Arial, sans-serif";
const TOURNAMENT_FONT_PATH = path.join(process.cwd(), "assets", "fonts", "Ubuntu-Medium.ttf");
const TOURNAMENT_LETTER_SPACING = 3;
const TOURNAMENT_SIZES = [50, 46, 42, 38] as const;

let tournamentFont: opentype.Font | null = null;

function loadTournamentFont(): opentype.Font {
  if (!tournamentFont) {
    const file = readFileSync(TOURNAMENT_FONT_PATH);
    tournamentFont = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  }
  return tournamentFont;
}

function glyphAdvance(font: opentype.Font, character: string, fontSize: number): number {
  const advance = font.charToGlyph(character).advanceWidth ?? 0;
  return advance * (fontSize / font.unitsPerEm);
}

export type ScheduleThumbnailFace = {
  tournamentName: string;
  stage: string;
  leftName: string;
  rightName: string;
  when: Date;
  serverName: string;
  serverIcon: Buffer | null;
};

export async function loadThumbnailFace(
  guild: Guild,
  tournament: TournamentRecord,
  match: Match,
  when: Date,
): Promise<ScheduleThumbnailFace> {
  const [stage, serverIcon] = await Promise.all([resolveStage(tournament.id, match), fetchGuildIcon(guild)]);
  return {
    tournamentName: tournament.name,
    stage,
    leftName: match.player1Name,
    rightName: match.player2Name,
    when,
    serverName: guild.name,
    serverIcon,
  };
}

async function fetchGuildIcon(guild: Guild): Promise<Buffer | null> {
  const url = guild.iconURL({ extension: "png", size: 256, forceStatic: true });
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function characterWidth(character: string): number {
  if (character === " ") {
    return 0.35;
  }
  if (/[Iil|.,'!:;·]/u.test(character)) {
    return 0.38;
  }
  if (/[MW@%&Q]/u.test(character)) {
    return 1.02;
  }
  return 0.74;
}

function estimatedWidth(value: string, fontSize: number, letterSpacing = 0): number {
  const characters = Array.from(value);
  return (
    characters.reduce((width, character) => width + characterWidth(character) * fontSize, 0) +
    Math.max(0, characters.length - 1) * letterSpacing
  );
}

export function truncateThumbnailText(value: string, maxWidth: number, fontSize: number, letterSpacing = 0): string {
  const normalized = value.trim().replace(/\s+/gu, " ").toUpperCase();
  if (estimatedWidth(normalized, fontSize, letterSpacing) <= maxWidth) {
    return normalized;
  }
  const ellipsis = "…";
  const characters = Array.from(normalized);
  while (characters.length > 1) {
    characters.pop();
    const candidate = `${characters.join("").trimEnd()}${ellipsis}`;
    if (estimatedWidth(candidate, fontSize, letterSpacing) <= maxWidth) {
      return candidate;
    }
  }
  return ellipsis;
}

/** Shrinks the font through `sizes` before cutting the text, so long names stay whole when possible. */
export function fitThumbnailText(
  value: string,
  maxWidth: number,
  sizes: readonly number[],
  letterSpacing = 0,
): { text: string; fontSize: number } {
  const normalized = value.trim().replace(/\s+/gu, " ").toUpperCase();
  for (const fontSize of sizes) {
    if (estimatedWidth(normalized, fontSize, letterSpacing) <= maxWidth) {
      return { text: normalized, fontSize };
    }
  }
  const smallest = sizes[sizes.length - 1] ?? 32;
  return { text: truncateThumbnailText(normalized, maxWidth, smallest, letterSpacing), fontSize: smallest };
}

function utcDate(when: Date): string {
  const day = String(when.getUTCDate()).padStart(2, "0");
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${when.getUTCFullYear()}`;
}

function utcTime(when: Date): string {
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute} UTC`;
}

function text(x: number, y: number, body: string, attrs: string): string {
  return `<text x="${x}" y="${y}" ${attrs}>${escapeXml(body)}</text>`;
}

function tournamentTextWidth(font: opentype.Font, value: string, fontSize: number, letterSpacing: number): number {
  const characters = Array.from(value);
  if (characters.length === 0) {
    return 0;
  }
  const glyphs = characters.reduce((width, character) => width + glyphAdvance(font, character, fontSize), 0);
  return glyphs + Math.max(0, characters.length - 1) * letterSpacing;
}

function fitTournamentTitle(value: string, maxWidth: number): { text: string; fontSize: number } {
  const font = loadTournamentFont();
  const normalized = value.trim().replace(/\s+/gu, " ").toUpperCase();
  for (const fontSize of TOURNAMENT_SIZES) {
    if (tournamentTextWidth(font, normalized, fontSize, TOURNAMENT_LETTER_SPACING) <= maxWidth) {
      return { text: normalized, fontSize };
    }
  }
  const fontSize = TOURNAMENT_SIZES[TOURNAMENT_SIZES.length - 1];
  const ellipsis = "…";
  const characters = Array.from(normalized);
  while (characters.length > 1) {
    characters.pop();
    const candidate = `${characters.join("").trimEnd()}${ellipsis}`;
    if (tournamentTextWidth(font, candidate, fontSize, TOURNAMENT_LETTER_SPACING) <= maxWidth) {
      return { text: candidate, fontSize };
    }
  }
  return { text: ellipsis, fontSize };
}

/** Draws the tournament name as Ubuntu Medium (500) outlines so sharp always uses that face. */
function tournamentTitlePath(value: string, fontSize: number, centerX: number, baselineY: number): string {
  const font = loadTournamentFont();
  const characters = Array.from(value);
  const total = tournamentTextWidth(font, value, fontSize, TOURNAMENT_LETTER_SPACING);
  let cursor = centerX - total / 2;
  const parts: string[] = [];
  for (const [index, character] of characters.entries()) {
    const glyph = font.charToGlyph(character);
    parts.push(glyph.getPath(cursor, baselineY, fontSize).toPathData(2));
    cursor += glyphAdvance(font, character, fontSize);
    if (index < characters.length - 1) {
      cursor += TOURNAMENT_LETTER_SPACING;
    }
  }
  return `<path d="${parts.join(" ")}" fill="url(#goldText)"/>`;
}

function artwork(face: ScheduleThumbnailFace): Buffer {
  const iconCenterY = ICON_TOP + ICON_SIZE / 2;
  const tournament = fitTournamentTitle(face.tournamentName, 920);
  const stage = truncateThumbnailText(face.stage, 320, 21, 3);
  const stageWidth = Math.max(220, Math.ceil(estimatedWidth(stage, 21, 3)) + 72);
  const left = fitThumbnailText(face.leftName, TEAM_MAX_WIDTH, [54, 48, 42, 36], 1);
  const right = fitThumbnailText(face.rightName, TEAM_MAX_WIDTH, [54, 48, 42, 36], 1);
  const server = truncateThumbnailText(face.serverName, 640, 20, 5);
  const serverWidth = estimatedWidth(server, 20, 5);

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#04060a" stop-opacity=".78"/>
          <stop offset=".3" stop-color="#04060a" stop-opacity=".42"/>
          <stop offset=".62" stop-color="#04060a" stop-opacity=".42"/>
          <stop offset="1" stop-color="#04060a" stop-opacity=".9"/>
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8a5a16"/>
          <stop offset=".5" stop-color="#f8d778"/>
          <stop offset="1" stop-color="#9d681c"/>
        </linearGradient>
        <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff0b8"/>
          <stop offset=".55" stop-color="#f1c85d"/>
          <stop offset="1" stop-color="#b8841f"/>
        </linearGradient>
        <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#04060a" stop-opacity="0"/>
          <stop offset=".12" stop-color="#04060a" stop-opacity=".72"/>
          <stop offset=".88" stop-color="#04060a" stop-opacity=".72"/>
          <stop offset="1" stop-color="#04060a" stop-opacity="0"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
          <feOffset dy="3"/>
          <feComponentTransfer><feFuncA type="linear" slope=".85"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
        </filter>
      </defs>

      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>

      <!-- frame -->
      <path d="M0 0H1280V14H0Z" fill="url(#gold)"/>
      <path d="M0 706H1280V720H0Z" fill="url(#gold)"/>
      <path d="M0 25H305L275 34H0Z" fill="#b4111b"/>
      <path d="M1280 25H975L1005 34H1280Z" fill="#b4111b"/>
      <path d="M0 695H305L275 686H0Z" fill="#b4111b"/>
      <path d="M1280 695H975L1005 686H1280Z" fill="#b4111b"/>

      <!-- server icon ring -->
      ${
        face.serverIcon
          ? `<circle cx="640" cy="${iconCenterY}" r="${ICON_SIZE / 2 + 12}" fill="#f1c85d" opacity=".35" filter="url(#glow)"/>
             <circle cx="640" cy="${iconCenterY}" r="${ICON_SIZE / 2 + 4}" fill="none" stroke="url(#gold)" stroke-width="4"/>`
          : ""
      }

      <g filter="url(#shadow)">
        <!-- tournament: Ubuntu Medium 500 -->
        ${tournamentTitlePath(tournament.text, tournament.fontSize, 640, 212)}

        <!-- stage pill -->
        <rect x="${640 - stageWidth / 2}" y="238" width="${stageWidth}" height="44" rx="22" fill="#07090e" fill-opacity=".92" stroke="url(#gold)" stroke-width="2"/>
        <circle cx="${640 - stageWidth / 2 + 22}" cy="260" r="4" fill="#dc1e29"/>
        <circle cx="${640 + stageWidth / 2 - 22}" cy="260" r="4" fill="#dc1e29"/>
        ${text(640, 268, stage, `font-family="${FONT}" text-anchor="middle" fill="#ffffff" font-size="21" font-weight="800" letter-spacing="3"`)}
      </g>

      <!-- versus band -->
      <rect x="0" y="318" width="${WIDTH}" height="118" fill="url(#band)"/>
      <path d="M120 318H1160" stroke="url(#gold)" stroke-width="2" opacity=".9"/>
      <path d="M120 436H1160" stroke="url(#gold)" stroke-width="2" opacity=".9"/>

      <g font-family="${FONT}" text-anchor="middle" filter="url(#shadow)">
        ${text(345, 377 + left.fontSize * 0.36, left.text, `fill="#ffffff" font-size="${left.fontSize}" font-weight="900" letter-spacing="1"`)}
        ${text(935, 377 + right.fontSize * 0.36, right.text, `fill="#ffffff" font-size="${right.fontSize}" font-weight="900" letter-spacing="1"`)}

        <!-- VS -->
        <text x="640" y="397" fill="#e01b26" font-size="56" font-weight="900" letter-spacing="1">VS</text>
      </g>

      <!-- date / time -->
      <g font-family="${FONT}" text-anchor="middle">
        <rect x="430" y="482" width="420" height="112" rx="12" fill="#05070b" fill-opacity=".9" stroke="url(#gold)" stroke-width="2"/>
        ${text(640, 526, `DATE: ${utcDate(face.when)}`, `fill="#ffffff" font-size="26" font-weight="800" letter-spacing="2"`)}
        ${text(640, 570, `TIME: ${utcTime(face.when)}`, `fill="#f1c85d" font-size="26" font-weight="800" letter-spacing="2"`)}
      </g>

      <!-- server name -->
      <g font-family="${FONT}" text-anchor="middle">
        <path d="M${640 - serverWidth / 2 - 130} 648H${640 - serverWidth / 2 - 24}" stroke="url(#gold)" stroke-width="2"/>
        <path d="M${640 + serverWidth / 2 + 24} 648H${640 + serverWidth / 2 + 130}" stroke="url(#gold)" stroke-width="2"/>
        ${text(640, 655, server, `fill="#e9e6dc" font-size="20" font-weight="700" letter-spacing="5"`)}
      </g>
    </svg>
  `);
}

async function circularIcon(source: Buffer): Promise<Buffer> {
  const mask = Buffer.from(
    `<svg width="${ICON_SIZE}" height="${ICON_SIZE}"><circle cx="${ICON_SIZE / 2}" cy="${ICON_SIZE / 2}" r="${ICON_SIZE / 2}" fill="#fff"/></svg>`,
  );
  return sharp(source)
    .resize(ICON_SIZE, ICON_SIZE, { fit: "cover" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

export async function renderScheduleThumbnail(face: ScheduleThumbnailFace, backgroundIndex: number): Promise<Buffer> {
  // The icon goes on top of the artwork so the dark shade and ring never dim it.
  const layers: sharp.OverlayOptions[] = [{ input: artwork(face), top: 0, left: 0 }];
  if (face.serverIcon) {
    const icon = await circularIcon(face.serverIcon).catch(() => null);
    if (icon) {
      layers.push({ input: icon, top: ICON_TOP, left: WIDTH / 2 - ICON_SIZE / 2 });
    }
  }
  return sharp(backgroundPath(backgroundIndex))
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .modulate({ saturation: 0.85, brightness: 0.8 })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
