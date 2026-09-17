import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { botSlash } from "../commands/bot/slash.js";
import { serverSlash } from "../commands/server/slash.js";
import { settingsSlash } from "../commands/settings/slash.js";
import { env } from "./env.js";

const slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  botSlash.toJSON(),
  settingsSlash.toJSON(),
  serverSlash.toJSON(),
];

export const botCommandIds = new Map<string, string>();
export const settingsCommandIds = new Map<string, string>();
export const serverCommandIds = new Map<string, string>();

export function botCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return botCommandIds.get(guildId);
}

export function settingsCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return settingsCommandIds.get(guildId);
}

export function serverCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return serverCommandIds.get(guildId);
}

export async function registerSlashCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.discordToken);

  for (const guildId of env.allowedGuilds) {
    const registered = (await rest.put(Routes.applicationGuildCommands(env.discordClientId, guildId), {
      body: slashCommands,
    })) as Array<{ id: string; name: string }>;

    const bot = registered.find((command) => command.name === "bot");
    if (bot) {
      botCommandIds.set(guildId, bot.id);
    }

    const settings = registered.find((command) => command.name === "settings");
    if (settings) {
      settingsCommandIds.set(guildId, settings.id);
    }

    const server = registered.find((command) => command.name === "server");
    if (server) {
      serverCommandIds.set(guildId, server.id);
    }
  }
}
