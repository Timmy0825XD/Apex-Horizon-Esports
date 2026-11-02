import os from "node:os";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "discord.js";

const packageVersion = (
  JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version: string }
).version;

export function botVersion(): string {
  return packageVersion;
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/** Short uptime for footers: `45s`, `1m 7s`, `3h 12m`, `2d 4h`. */
export function compactDuration(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/** Memory the bot process uses, without the host total. */
export function processMemory(): string {
  return formatBytes(process.memoryUsage().rss);
}

export function hostMemory(): string {
  return formatBytes(os.totalmem());
}

/** CPU model without vendor noise: "AMD EPYC 7763 64-Core Processor" → "AMD EPYC 7763". */
export function shortCpuModel(): string {
  return cpuModel()
    .replace(/\((R|TM)\)/gi, "")
    .replace(/\s+\d+-Core Processor/i, "")
    .replace(/\s+CPU\s+@.*$/i, "")
    .replace(/\s+Processor$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function memoryLine(): string {
  return `${formatBytes(process.memoryUsage().rss)} / ${formatBytes(os.totalmem())}`;
}

export function cpuModel(): string {
  return os.cpus()[0]?.model ?? "Unknown";
}

export function npmVersion(): string | null {
  const match = process.env.npm_config_user_agent?.match(/npm\/(\S+)/);
  return match?.[1] ?? null;
}

export function reach(client: Client): { servers: number; members: number } {
  let members = 0;
  for (const guild of client.guilds.cache.values()) {
    members += guild.memberCount;
  }
  return { servers: client.guilds.cache.size, members };
}
