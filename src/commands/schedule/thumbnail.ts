import path from "node:path";
import type { Guild } from "discord.js";
import type { Match } from "@prisma/client";
import { GlobalFonts, createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import sharp from "sharp";
import type { TournamentRecord } from "../tournament/fields.js";
import { backgroundPath, normalizeBackground } from "./backgrounds.js";
import { resolveStage } from "./stage.js";

const WIDTH = 1280;
const HEIGHT = 720;
const CENTER = WIDTH / 2;

const GOLD = "#e8b84a";
const RED = "#e0262f";
const WHITE = "#ffffff";
const MUTED = "rgba(255, 255, 255, 0.62)";

// One face per role: tournament title, team names, VS, and the small info lines.
const FONTS = {
  title: { file: "ChakraPetch-Bold.ttf", family: "AHE Title" },
  team: { file: "SairaCondensed-ExtraBold.ttf", family: "AHE Team" },
  versus: { file: "Audiowide-Regular.ttf", family: "AHE Versus" },
  info: { file: "Rajdhani-SemiBold.ttf", family: "AHE Info" },
  infoBold: { file: "Rajdhani-Bold.ttf", family: "AHE Info Bold" },
} as const;

let fontsReady = false;

function registerFonts(): void {
  if (fontsReady) {
    return;
  }
  const dir = path.join(process.cwd(), "assets", "fonts");
  for (const { file, family } of Object.values(FONTS)) {
    GlobalFonts.registerFromPath(path.join(dir, file), family);
  }
  fontsReady = true;
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

// Keyed by icon URL, so a new server icon downloads once and the old entry is dropped.
const guildIcons = new Map<string, { url: string; icon: Buffer }>();

async function fetchGuildIcon(guild: Guild): Promise<Buffer | null> {
  const url = guild.iconURL({ extension: "png", size: 256, forceStatic: true });
  if (!url) {
    return null;
  }
  const cached = guildIcons.get(guild.id);
  if (cached?.url === url) {
    return cached.icon;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const icon = Buffer.from(await response.arrayBuffer());
    guildIcons.set(guild.id, { url, icon });
    return icon;
  } catch {
    return null;
  }
}

// The source backgrounds are 1920x1080 PNGs of several MB. Each one is resized once to the
// canvas size and kept as a small JPEG, so later renders skip the heavy decode.
const backgrounds = new Map<number, Promise<Buffer>>();

function backgroundImage(index: number): Promise<Buffer> {
  const safe = normalizeBackground(index);
  let cached = backgrounds.get(safe);
  if (!cached) {
    cached = sharp(backgroundPath(safe))
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 92 })
      .toBuffer();
    cached.catch(() => backgrounds.delete(safe));
    backgrounds.set(safe, cached);
  }
  return cached;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toUpperCase();
}

function setFont(ctx: SKRSContext2D, family: string, size: number, spacing: number): void {
  ctx.font = `${size}px "${family}"`;
  ctx.letterSpacing = `${spacing}px`;
}

/** Shrinks through `sizes`, then cuts with an ellipsis, measuring with the real font. */
function fitText(
  ctx: SKRSContext2D,
  value: string,
  family: string,
  sizes: readonly number[],
  maxWidth: number,
  spacing = 0,
): { text: string; size: number } {
  const text = normalize(value);
  for (const size of sizes) {
    setFont(ctx, family, size, spacing);
    if (ctx.measureText(text).width <= maxWidth) {
      return { text, size };
    }
  }
  const size = sizes[sizes.length - 1] ?? 24;
  setFont(ctx, family, size, spacing);
  const characters = Array.from(text);
  while (characters.length > 1) {
    characters.pop();
    const candidate = `${characters.join("").trimEnd()}…`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      return { text: candidate, size };
    }
  }
  return { text: "…", size };
}

/** Letter spacing pads the last glyph too; shift by half of it so the text stays centred. */
function drawCentered(ctx: SKRSContext2D, text: string, x: number, y: number, spacing: number): void {
  ctx.textAlign = "center";
  ctx.fillText(text, x + spacing / 2, y);
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function utcDate(when: Date): string {
  const day = String(when.getUTCDate()).padStart(2, "0");
  return `${WEEKDAYS[when.getUTCDay()]} ${day} ${MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}`;
}

function utcTime(when: Date): string {
  const hour = String(when.getUTCHours()).padStart(2, "0");
  const minute = String(when.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute} UTC`;
}

function drawBackdrop(ctx: SKRSContext2D, background: Image): void {
  ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "rgba(6, 8, 12, 0.58)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const vignette = ctx.createRadialGradient(CENTER, HEIGHT / 2, 220, CENTER, HEIGHT / 2, 820);
  vignette.addColorStop(0, "rgba(6, 8, 12, 0)");
  vignette.addColorStop(1, "rgba(6, 8, 12, 0.75)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Darker band behind the teams so the names read on any background.
  const band = ctx.createLinearGradient(0, 0, WIDTH, 0);
  band.addColorStop(0, "rgba(6, 8, 12, 0)");
  band.addColorStop(0.2, "rgba(6, 8, 12, 0.6)");
  band.addColorStop(0.8, "rgba(6, 8, 12, 0.6)");
  band.addColorStop(1, "rgba(6, 8, 12, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 300, WIDTH, 150);
}

/**
 * HUD corners, the only frame the card has: a chamfered gold bracket, three red hazard
 * slashes inside it, and tick marks running along each arm. Drawn once for the top-left
 * corner and mirrored into the other three.
 */
function drawCorners(ctx: SKRSContext2D): void {
  const inset = 24;
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [WIDTH - inset, inset, -1, 1],
    [inset, HEIGHT - inset, 1, -1],
    [WIDTH - inset, HEIGHT - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    drawCorner(ctx);
    ctx.restore();
  }
}

function drawCorner(ctx: SKRSContext2D): void {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(0, 14);
  ctx.lineTo(14, 0);
  ctx.lineTo(64, 0);
  ctx.stroke();

  ctx.fillStyle = RED;
  for (const offset of [0, 9, 18]) {
    ctx.beginPath();
    ctx.moveTo(14 + offset, 10);
    ctx.lineTo(19 + offset, 10);
    ctx.lineTo(10 + offset, 19);
    ctx.lineTo(5 + offset, 19);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = GOLD;
  for (let x = 74; x <= 114; x += 10) {
    ctx.fillRect(x, -1, 4, 2);
  }
  for (let y = 74; y <= 94; y += 10) {
    ctx.fillRect(-1, y, 2, 4);
  }
}

async function drawServerIcon(ctx: SKRSContext2D, icon: Buffer | null): Promise<void> {
  if (!icon) {
    return;
  }
  const image = await loadImage(icon).catch(() => null);
  if (!image) {
    return;
  }
  const radius = 34;
  const cy = 74;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, CENTER - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER, cy, radius + 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHeader(ctx: SKRSContext2D, face: ScheduleThumbnailFace): void {
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 12;

  const title = fitText(ctx, face.tournamentName, FONTS.title.family, [50, 46, 42, 38, 34], 1000, 3);
  ctx.fillStyle = WHITE;
  drawCentered(ctx, title.text, CENTER, 184, 3);

  ctx.shadowBlur = 0;
  ctx.fillStyle = RED;
  ctx.fillRect(CENTER - 28, 204, 56, 3);

  const stage = fitText(ctx, face.stage, FONTS.infoBold.family, [24, 22, 20], 640, 6);
  ctx.fillStyle = GOLD;
  drawCentered(ctx, stage.text, CENTER, 244, 6);
}

const TEAM_SIZES = [96, 88, 80, 72, 64];
const TEAM_SPACING = 1;
const TEAM_TWO_LINE_SIZES = [66, 60, 54];
const TEAM_MAX_WIDTH = 450;
// Vertical middle of the team names, between the band edges (300–450).
const TEAM_MIDDLE = 376;

/** Splits at the space that makes the two halves closest in width. */
function splitInTwo(ctx: SKRSContext2D, text: string): [string, string] | null {
  const words = text.split(" ");
  let best: [string, string] | null = null;
  let bestWidth = Infinity;
  for (let index = 1; index < words.length; index += 1) {
    const pair: [string, string] = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
    const widest = Math.max(ctx.measureText(pair[0]).width, ctx.measureText(pair[1]).width);
    if (widest < bestWidth) {
      best = pair;
      bestWidth = widest;
    }
  }
  return best;
}

/** One big line when it fits, two balanced lines for long names, an ellipsis as the last resort. */
function fitTeam(ctx: SKRSContext2D, value: string): { lines: string[]; size: number } {
  const text = normalize(value);
  for (const size of TEAM_SIZES) {
    setFont(ctx, FONTS.team.family, size, TEAM_SPACING);
    if (ctx.measureText(text).width <= TEAM_MAX_WIDTH) {
      return { lines: [text], size };
    }
  }
  for (const size of TEAM_TWO_LINE_SIZES) {
    setFont(ctx, FONTS.team.family, size, TEAM_SPACING);
    const pair = splitInTwo(ctx, text);
    if (pair && pair.every((line) => ctx.measureText(line).width <= TEAM_MAX_WIDTH)) {
      return { lines: pair, size };
    }
  }
  const single = fitText(ctx, text, FONTS.team.family, TEAM_SIZES.slice(-1), TEAM_MAX_WIDTH, TEAM_SPACING);
  return { lines: [single.text], size: single.size };
}

function drawTeam(ctx: SKRSContext2D, value: string, centerX: number): void {
  const team = fitTeam(ctx, value);
  setFont(ctx, FONTS.team.family, team.size, TEAM_SPACING);
  // Saira caps sit about 0.7em tall, so the baseline goes 0.35em below the middle.
  const lineGap = team.size * 0.95;
  const first = TEAM_MIDDLE + team.size * 0.35 - (lineGap * (team.lines.length - 1)) / 2;
  team.lines.forEach((line, index) => drawCentered(ctx, line, centerX, first + lineGap * index, TEAM_SPACING));
}

function drawMatchup(ctx: SKRSContext2D, face: ScheduleThumbnailFace): void {
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = WHITE;
  drawTeam(ctx, face.leftName, 330);
  drawTeam(ctx, face.rightName, 950);

  ctx.shadowBlur = 0;
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 14;
  setFont(ctx, FONTS.versus.family, 66, 0);
  ctx.fillStyle = RED;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", CENTER, TEAM_MIDDLE);
  ctx.textBaseline = "alphabetic";
  ctx.shadowBlur = 0;
}

function drawSchedule(ctx: SKRSContext2D, face: ScheduleThumbnailFace): void {
  const date = utcDate(face.when);
  const time = utcTime(face.when);
  const gap = 28;
  setFont(ctx, FONTS.info.family, 34, 4);
  const dateWidth = ctx.measureText(date).width;
  setFont(ctx, FONTS.infoBold.family, 34, 4);
  const timeWidth = ctx.measureText(time).width;
  const start = CENTER - (dateWidth + gap * 2 + timeWidth) / 2;
  const baseline = 540;

  ctx.textAlign = "left";
  setFont(ctx, FONTS.info.family, 34, 4);
  ctx.fillStyle = WHITE;
  ctx.fillText(date, start, baseline);
  ctx.fillStyle = GOLD;
  ctx.fillRect(start + dateWidth + gap - 1, baseline - 28, 2, 32);
  setFont(ctx, FONTS.infoBold.family, 34, 4);
  ctx.fillText(time, start + dateWidth + gap * 2, baseline);
}

function drawFooter(ctx: SKRSContext2D, face: ScheduleThumbnailFace): void {
  const server = fitText(ctx, face.serverName, FONTS.info.family, [20, 18], 700, 7);
  ctx.fillStyle = MUTED;
  drawCentered(ctx, server.text, CENTER, 664, 7);
}

export async function renderScheduleThumbnail(face: ScheduleThumbnailFace, backgroundIndex: number): Promise<Buffer> {
  registerFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const background = await loadImage(await backgroundImage(backgroundIndex));
  drawBackdrop(ctx, background);
  drawCorners(ctx);
  await drawServerIcon(ctx, face.serverIcon);
  drawHeader(ctx, face);
  drawMatchup(ctx, face);
  drawSchedule(ctx, face);
  drawFooter(ctx, face);
  return canvas.encode("jpeg", 90);
}
