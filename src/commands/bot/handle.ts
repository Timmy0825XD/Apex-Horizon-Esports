import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { botCommandIdFor, serverCommandIdFor, settingsCommandIdFor, staffCommandIdFor, tournamentCommandIdFor, utilityCommandIdFor } from "../../lib/register-slash.js";
import { buildAboutContainer } from "./about.js";
import { buildHelpContainer, normalizeHelpPage } from "./help.js";
import { buildPingContainer } from "./ping.js";
import { panelMessage, type BotPanel, type BotViewContext } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

async function buildPanel(panel: BotPanel, ctx: BotViewContext) {
  if (panel === "about") {
    return panelMessage("about", await buildAboutContainer(ctx));
  }
  if (panel === "help") {
    return panelMessage("help", buildHelpContainer({ ...ctx, helpPage: normalizeHelpPage(ctx.helpPage) }));
  }
  return panelMessage("ping", await buildPingContainer(ctx));
}

export async function handleBotSlash(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const sub = interaction.options.getSubcommand();
  const panel: BotPanel = sub === "about" || sub === "help" || sub === "ping" ? sub : "ping";
  await interaction.reply(
    await buildPanel(panel, {
      client,
      createdTimestamp: interaction.createdTimestamp,
      commandId: botCommandIdFor(interaction.guildId) ?? interaction.commandId,
      settingsCommandId: settingsCommandIdFor(interaction.guildId),
      serverCommandId: serverCommandIdFor(interaction.guildId),
      staffCommandId: staffCommandIdFor(interaction.guildId),
      tournamentCommandId: tournamentCommandIdFor(interaction.guildId),
      utilityCommandId: utilityCommandIdFor(interaction.guildId),
      helpPage: 0,
    }),
  );
}

export async function handleBotButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const id = interaction.customId;
  if (id === "bot:help:current") {
    await interaction.deferUpdate();
    return;
  }

  let panel: BotPanel = "ping";
  let helpPage = 0;
  if (id === "bot:nav:about") {
    panel = "about";
  } else if (id === "bot:nav:ping") {
    panel = "ping";
  } else if (id === "bot:nav:help") {
    panel = "help";
    helpPage = 0;
  } else if (id.startsWith("bot:help:")) {
    panel = "help";
    helpPage = normalizeHelpPage(Number(id.slice("bot:help:".length)));
  } else {
    return;
  }

  await interaction.update(
    await buildPanel(panel, {
      client,
      createdTimestamp: interaction.createdTimestamp,
      commandId: botCommandIdFor(interaction.guildId),
      settingsCommandId: settingsCommandIdFor(interaction.guildId),
      serverCommandId: serverCommandIdFor(interaction.guildId),
      staffCommandId: staffCommandIdFor(interaction.guildId),
      tournamentCommandId: tournamentCommandIdFor(interaction.guildId),
      utilityCommandId: utilityCommandIdFor(interaction.guildId),
      helpPage,
    }),
  );
}
