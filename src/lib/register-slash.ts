import {
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { attendanceSlash } from "../commands/attendance/slash.js";
import { botSlash } from "../commands/bot/slash.js";
import { getSlash } from "../commands/get/slash.js";
import { linkSlash } from "../commands/link/slash.js";
import { bracketSlash } from "../commands/bracket/slash.js";
import { roomSlash } from "../commands/room/slash.js";
import { ticketSlash } from "../commands/ticket/slash.js";
import { scheduleSlash } from "../commands/schedule/slash.js";
import { roleSlash } from "../commands/role/slash.js";
import { serverSlash } from "../commands/server/slash.js";
import { settingsSlash } from "../commands/settings/slash.js";
import { staffSlash } from "../commands/staff/slash.js";
import { sheetSlash } from "../commands/sheet/slash.js";
import { teamSlash } from "../commands/team/slash.js";
import { tournamentSlash } from "../commands/tournament/slash.js";
import { userSlash } from "../commands/user/slash.js";
import { utilitySlash } from "../commands/utility/slash.js";
import { env } from "./env.js";
import { formatHelpEntry } from "./formatters.js";

const slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  botSlash.toJSON(),
  settingsSlash.toJSON(),
  serverSlash.toJSON(),
  staffSlash.toJSON(),
  tournamentSlash.toJSON(),
  sheetSlash.toJSON(),
  teamSlash.toJSON(),
  roleSlash.toJSON(),
  userSlash.toJSON(),
  utilitySlash.toJSON(),
  roomSlash.toJSON(),
  ticketSlash.toJSON(),
  bracketSlash.toJSON(),
  scheduleSlash.toJSON(),
  attendanceSlash.toJSON(),
  linkSlash.toJSON(),
  getSlash.toJSON(),
].map(omitOptionalRequired);

function omitOptionalRequired(value: RESTPostAPIChatInputApplicationCommandsJSONBody): RESTPostAPIChatInputApplicationCommandsJSONBody {
  return stripFalseRequired(value) as RESTPostAPIChatInputApplicationCommandsJSONBody;
}

function stripFalseRequired(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripFalseRequired);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "required" && child === false) {
        continue;
      }
      out[key] = stripFalseRequired(child);
    }
    return out;
  }
  return value;
}

// Command IDs per guild, filled on registration. Mentions like </attendance mark:ID> need them
// to be clickable; without an ID the text falls back to plain code.
const commandIds = new Map<string, Map<string, string>>();

export function commandIdFor(guildId: string | null | undefined, name: string): string | undefined {
  if (!guildId) {
    return undefined;
  }
  return commandIds.get(guildId)?.get(name);
}

export const botCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "bot");
export const settingsCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "settings");
export const serverCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "server");
export const staffCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "staff");
export const tournamentCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "tournament");
export const sheetCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "sheet");
export const teamCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "team");
export const roleCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "role");
export const userCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "user");
export const utilityCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "utility");
export const roomCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "room");
export const ticketCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "ticket");
export const bracketCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "bracket");
export const scheduleCommandIdFor = (guildId: string | null | undefined) => commandIdFor(guildId, "schedule");

/** Clickable </command sub:ID> mention; plain `/command sub` code until the ID is known. */
export function slashMention(guildId: string | null | undefined, path: string): string {
  return formatHelpEntry(path, commandIdFor(guildId, path.split(" ")[0] ?? path));
}

export async function registerSlashCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.discordToken);

  for (const guildId of env.allowedGuilds) {
    const registered = (await rest.put(Routes.applicationGuildCommands(env.discordClientId, guildId), {
      body: slashCommands,
    })) as Array<{ id: string; name: string }>;
    commandIds.set(guildId, new Map(registered.map((command) => [command.name, command.id])));
  }
}

/** Full subcommand path without the command name: `"dq both"`, `"results add"`, `"create"`. */
export function subcommandPath(interaction: ChatInputCommandInteraction): string {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  return group ? `${group} ${sub}` : sub;
}
