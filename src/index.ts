import "./lib/env.js";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { handleBotButton, handleBotSlash } from "./commands/bot/handle.js";
import { handleServerSlash } from "./commands/server/handle.js";
import { handleSettingsSlash } from "./commands/settings/handle.js";
import { handleStaffAuto, handleStaffSlash } from "./commands/staff/handle.js";
import { isAllowedGuild } from "./lib/allowed-guilds.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { registerSlashCommands } from "./lib/register-slash.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

async function leaveIfUnauthorized(guildId: string, leave: () => Promise<unknown>): Promise<void> {
  if (!isAllowedGuild(guildId)) {
    await leave();
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  for (const guild of readyClient.guilds.cache.values()) {
    await leaveIfUnauthorized(guild.id, () => guild.leave());
  }

  await registerSlashCommands();
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

    if (interaction.isAutocomplete() && interaction.commandName === "staff") {
      await handleStaffAuto(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("bot:")) {
      await handleBotButton(interaction, client);
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

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed at startup; /bot ping will report database errors.", error);
  }

  await client.login(env.discordToken);
}

async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  client.destroy();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

void main();
