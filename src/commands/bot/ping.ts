import { ContainerBuilder } from "discord.js";
import { emojis } from "../../emojis.js";
import { prisma } from "../../lib/prisma.js";
import { compactDuration, processMemory, reach } from "../../lib/runtime.js";
import { botAvatarUrl, divider, headingWithThumbnail, statusColors, textBlock, type BotViewContext } from "./view.js";

type Level = "good" | "slow" | "bad";

const GOOD_UNDER_MS = 200;
const SLOW_UNDER_MS = 500;

type Check = { label: string; subject: string; ms: number | null; error?: string };

async function measureDatabasePing(): Promise<{ ms: number } | { error: string }> {
  const started = Date.now();
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return { ms: Date.now() - started };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown database error" };
  }
}

function levelOf(check: Check): Level {
  if (check.error) {
    return "bad";
  }
  if (check.ms == null || check.ms < GOOD_UNDER_MS) {
    return "good";
  }
  return check.ms < SLOW_UNDER_MS ? "slow" : "bad";
}

const levelRank: Record<Level, number> = { good: 0, slow: 1, bad: 2 };

function headline(checks: Check[], worst: Level): string {
  const failing = checks.find((check) => check.error);
  if (failing) {
    return `${failing.subject[0]?.toUpperCase()}${failing.subject.slice(1)} is not responding.`;
  }
  if (worst === "good") {
    return "All systems normal.";
  }
  const slowest = [...checks].sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))[0];
  if (worst === "bad") {
    return `Responses are slow right now. The slowest is ${slowest?.subject ?? "the bot"}.`;
  }
  return `Everything is up, but ${slowest?.subject ?? "the bot"} is a little slow right now.`;
}

function checkLine(check: Check): string {
  if (check.error) {
    return `> **${check.label}** · *down*`;
  }
  if (check.ms == null) {
    return `> **${check.label}** · *measuring*`;
  }
  const level = levelOf(check);
  const note = level === "slow" ? " · *slow*" : level === "bad" ? " · *very slow*" : "";
  return `> **${check.label}** \`${check.ms} ms\`${note}`;
}

export async function buildPingContainer(ctx: BotViewContext): Promise<ContainerBuilder> {
  const commandMs = Math.max(0, Date.now() - ctx.createdTimestamp);
  const database = await measureDatabasePing();
  const gatewayMs = ctx.client.ws.ping;

  const checks: Check[] = [
    { label: "Discord gateway", subject: "the Discord gateway", ms: gatewayMs >= 0 ? gatewayMs : null },
    "ms" in database
      ? { label: "Database", subject: "the database", ms: database.ms }
      : { label: "Database", subject: "the database", ms: null, error: database.error },
    { label: "Command response", subject: "command response", ms: commandMs },
  ];
  const worst = checks.map(levelOf).reduce<Level>((acc, level) => (levelRank[level] > levelRank[acc] ? level : acc), "good");

  const { servers, members } = reach(ctx.client);
  const heading = `## ${emojis.ping} Pong`;
  const avatar = botAvatarUrl(ctx.client);
  const container = new ContainerBuilder().setAccentColor(statusColors[worst]);
  if (avatar) {
    container.addSectionComponents(headingWithThumbnail(heading, avatar, headline(checks, worst)));
  } else {
    container.addTextDisplayComponents(textBlock(heading), textBlock(headline(checks, worst)));
  }

  const failing = checks.find((check) => check.error);
  const lines = [`### ${emojis.runtime} Latency`, ...checks.map(checkLine), failing ? `-# ${failing.error}` : ""].filter(Boolean);

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(lines.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        `-# RAM ${processMemory()} · Up ${compactDuration(process.uptime())} · ${servers.toLocaleString("en-US")} ${servers === 1 ? "server" : "servers"} · ${members.toLocaleString("en-US")} members`,
      ),
    );
}
