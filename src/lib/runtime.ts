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
