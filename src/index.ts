import "./lib/env.js";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { handleAutoRoomAuto, handleAutoRoomSlash } from "./commands/auto-room/handle.js";
import { handleAttendanceAuto, handleAttendanceSlash } from "./commands/attendance/handle.js";
import { handleGetAuto, handleGetSlash } from "./commands/get/handle.js";
import { handleLinkAuto, handleLinkSlash } from "./commands/link/handle.js";
import {
  handleBracketAutocomplete,
  handleBracketButtonInteraction,
  handleBracketSlash,
} from "./commands/bracket/handle.js";
import { handleBotButton, handleBotSlash } from "./commands/bot/handle.js";
import { handleRoomAuto, handleRoomButton, handleRoomSlash } from "./commands/room/handle.js";
import { handleScheduleButton } from "./commands/schedule/buttons.js";
import { handleScheduleSlash } from "./commands/schedule/handle.js";
import { handleScheduleAuto } from "./commands/schedule/autocomplete.js";
import { handleTicketSlash } from "./commands/ticket/handle.js";
import { handleRoleSlash } from "./commands/role/handle.js";
import { handleServerSlash } from "./commands/server/handle.js";
import { handleSettingsSlash } from "./commands/settings/handle.js";
import { handleStaffAuto, handleStaffSlash } from "./commands/staff/handle.js";
import { handleTeamAuto, handleTeamSlash } from "./commands/team/handle.js";
import { handleTournamentAuto, handleTournamentButton, handleTournamentSlash } from "./commands/tournament/handle.js";
import { handleUserSlash } from "./commands/user/handle.js";
import { handleUtilityButton, handleUtilityModal, handleUtilitySlash } from "./commands/utility/handle.js";
import { isAllowedGuild } from "./lib/allowed-guilds.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { registerSlashCommands } from "./lib/register-slash.js";
import { startAutoRoomWorker, stopAutoRoomWorker } from "./workers/auto-room.js";
import { startScheduleWorker, stopScheduleWorker } from "./workers/schedule.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function leaveIfUnauthorized(guildId: string, leave: () => Promise<unknown>): Promise<void> {
  if (!isAllowedGuild(guildId)) {
    await leave();
  }
}

client.on(Events.ClientReady, () => {
  if (!networkStopped) {
    networkAttempts = 0;
  }
});

client.once(Events.ClientReady, async (readyClient) => {
  for (const guild of readyClient.guilds.cache.values()) {
    await leaveIfUnauthorized(guild.id, () => guild.leave());
  }

  await registerSlashCommands();
  startAutoRoomWorker(readyClient);
  startScheduleWorker(readyClient);
  console.log(`Ready as ${readyClient.user.tag}`);
});

client.on(Events.GuildCreate, async (guild) => {
  await leaveIfUnauthorized(guild.id, () => guild.leave());
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "bot") {
      await handleBotSlash(interaction, client);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "settings") {
      await handleSettingsSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "server") {
      await handleServerSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "staff") {
      await handleStaffSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "tournament") {
      await handleTournamentSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "team") {
      await handleTeamSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "role") {
      await handleRoleSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "user") {
      await handleUserSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "utility") {
      await handleUtilitySlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "auto_room") {
      await handleAutoRoomSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "room") {
      await handleRoomSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
      await handleTicketSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "bracket") {
      await handleBracketSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "schedule") {
      await handleScheduleSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "attendance") {
      await handleAttendanceSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "link") {
      await handleLinkSlash(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "get") {
      await handleGetSlash(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "staff") {
      await handleStaffAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "tournament") {
      await handleTournamentAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "team") {
      await handleTeamAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "auto_room") {
      await handleAutoRoomAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "room") {
      await handleRoomAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "schedule") {
      await handleScheduleAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "bracket") {
      await handleBracketAutocomplete(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "attendance") {
      await handleAttendanceAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "link") {
      await handleLinkAuto(interaction);
      return;
    }

    if (interaction.isAutocomplete() && interaction.commandName === "get") {
      await handleGetAuto(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("tournament:")) {
      await handleTournamentButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("bracket:")) {
      await handleBracketButtonInteraction(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("utility:")) {
      await handleUtilityButton(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("utility:")) {
      await handleUtilityModal(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("room:")) {
      await handleRoomButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("bot:")) {
      await handleBotButton(interaction, client);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("schedule:")) {
      await handleScheduleButton(interaction);
    }
  } catch (error) {
    console.error("Interaction failed", error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "Something went wrong while running that command.", flags: MessageFlags.Ephemeral })
        .catch(() => undefined);
    }
  }
});

const maxNetworkAttempts = 4;
let networkAttempts = 0;
let networkStopped = false;

function isTransientNetworkError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "EAI_FAIL" || code === "EAI_AGAIN" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "ECONNRESET" || code === "UND_ERR_CONNECT_TIMEOUT";
}

function networkWhere(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code ?? "network";
  const hostname = (error as { hostname?: string }).hostname;
  return hostname ? `${code} ${hostname}` : code;
}

function stopForNetwork(): void {
  if (networkStopped) {
    return;
  }
  networkStopped = true;
  console.error("Discord network failed 4 times. Stopping.");
  void shutdown().finally(() => process.exit(1));
}

function noteNetworkError(error: unknown): boolean {
  if (!isTransientNetworkError(error)) {
    return false;
  }
  if (networkStopped) {
    return true;
  }
  networkAttempts += 1;
  console.error(`Discord network error (${networkAttempts}/${maxNetworkAttempts}): ${networkWhere(error)}`);
  if (networkAttempts >= maxNetworkAttempts) {
    stopForNetwork();
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed at startup; /bot ping will report database errors.", error);
  }

  for (let attempt = 1; attempt <= maxNetworkAttempts; attempt += 1) {
    if (networkStopped) {
      return;
    }
    try {
      await client.login(env.discordToken);
      return;
    } catch (error) {
      if (networkStopped) {
        return;
      }
      if (noteNetworkError(error)) {
        if (networkStopped || attempt === maxNetworkAttempts) {
          stopForNetwork();
          return;
        }
        await sleep(2000 * attempt);
        continue;
      }
      throw error;
    }
  }
}

async function shutdown(): Promise<void> {
  stopAutoRoomWorker();
  stopScheduleWorker();
  await prisma.$disconnect();
  client.destroy();
}

client.on(Events.Error, (error) => {
  if (noteNetworkError(error)) {
    return;
  }
  console.error("Discord client error:", error);
});

client.on(Events.ShardError, (error) => {
  if (noteNetworkError(error)) {
    return;
  }
  console.error("Discord shard error:", error);
});

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (no crash):", reason);
});

void main().catch((error) => {
  if (networkStopped) {
    return;
  }
  console.error("Fatal startup error, saliendo:", error);
  void shutdown().finally(() => process.exit(1));
});
