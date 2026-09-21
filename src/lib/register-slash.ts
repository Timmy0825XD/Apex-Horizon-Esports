import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { botSlash } from "../commands/bot/slash.js";
import { roleSlash } from "../commands/role/slash.js";
import { serverSlash } from "../commands/server/slash.js";
import { settingsSlash } from "../commands/settings/slash.js";
import { staffSlash } from "../commands/staff/slash.js";
import { teamSlash } from "../commands/team/slash.js";
import { tournamentSlash } from "../commands/tournament/slash.js";
import { userSlash } from "../commands/user/slash.js";
import { utilitySlash } from "../commands/utility/slash.js";
import { env } from "./env.js";

const slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  botSlash.toJSON(),
  settingsSlash.toJSON(),
  serverSlash.toJSON(),
  staffSlash.toJSON(),
  tournamentSlash.toJSON(),
  teamSlash.toJSON(),
  roleSlash.toJSON(),
  userSlash.toJSON(),
  utilitySlash.toJSON(),
];

export const botCommandIds = new Map<string, string>();
export const settingsCommandIds = new Map<string, string>();
export const serverCommandIds = new Map<string, string>();
export const staffCommandIds = new Map<string, string>();
export const tournamentCommandIds = new Map<string, string>();
export const teamCommandIds = new Map<string, string>();
export const roleCommandIds = new Map<string, string>();
export const userCommandIds = new Map<string, string>();
export const utilityCommandIds = new Map<string, string>();

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

export function staffCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return staffCommandIds.get(guildId);
}

export function tournamentCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return tournamentCommandIds.get(guildId);
}

export function teamCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return teamCommandIds.get(guildId);
}

export function roleCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return roleCommandIds.get(guildId);
}

export function userCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return userCommandIds.get(guildId);
}

export function utilityCommandIdFor(guildId: string | null | undefined): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return utilityCommandIds.get(guildId);
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

    const staff = registered.find((command) => command.name === "staff");
    if (staff) {
      staffCommandIds.set(guildId, staff.id);
    }

    const tournament = registered.find((command) => command.name === "tournament");
    if (tournament) {
      tournamentCommandIds.set(guildId, tournament.id);
    }

    const team = registered.find((command) => command.name === "team");
    if (team) {
      teamCommandIds.set(guildId, team.id);
    }

    const role = registered.find((command) => command.name === "role");
    if (role) {
      roleCommandIds.set(guildId, role.id);
    }

    const user = registered.find((command) => command.name === "user");
    if (user) {
      userCommandIds.set(guildId, user.id);
    }

    const utility = registered.find((command) => command.name === "utility");
    if (utility) {
      utilityCommandIds.set(guildId, utility.id);
    }
  }
}
