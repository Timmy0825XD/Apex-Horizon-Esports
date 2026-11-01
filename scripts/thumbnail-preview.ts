/**
 * Renders a schedule thumbnail with sample data through the bot's own renderer, so the design
 * can be checked without creating a real schedule.
 *
 *   npm run thumbnail:preview -- [--bg 3] [--icon path.png] [--out file.jpg]
 *                                [--tournament "…"] [--stage "…"] [--left "…"] [--right "…"] [--server "…"]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createCanvas } from "@napi-rs/canvas";
import { renderScheduleThumbnail } from "../src/commands/schedule/thumbnail.js";

const { values } = parseArgs({
  options: {
    bg: { type: "string", default: "1" },
    icon: { type: "string" },
    out: { type: "string", default: "thumbnail-preview.jpg" },
    tournament: { type: "string", default: "Apex Horizon Winter Cup 2026" },
    stage: { type: "string", default: "GROUP B · ROUND 3" },
    left: { type: "string", default: "Shadow Wolves" },
    right: { type: "string", default: "Nova Esports Academy" },
    server: { type: "string", default: "Apex Horizon Esports" },
  },
});

/** Stand-in for a Discord server icon when --icon is not given. */
function sampleIcon(): Buffer {
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#151b2b";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#e8b84a";
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AH", 128, 136);
  return canvas.toBuffer("image/png");
}

async function main(): Promise<void> {
  const face = {
    tournamentName: values.tournament,
    stage: values.stage,
    leftName: values.left,
    rightName: values.right,
    when: new Date(Date.UTC(2026, 10, 14, 19, 30)),
    serverName: values.server,
    serverIcon: values.icon ? readFileSync(values.icon) : sampleIcon(),
  };
  const background = Number(values.bg);
  const first = performance.now();
  const image = await renderScheduleThumbnail(face, background);
  const cold = performance.now() - first;
  const second = performance.now();
  await renderScheduleThumbnail(face, background);
  const warm = performance.now() - second;
  writeFileSync(values.out, image);
  console.log(`${values.out}: ${Math.round(image.length / 1024)} KB · first render ${Math.round(cold)} ms · next ${Math.round(warm)} ms`);
}

void main();
