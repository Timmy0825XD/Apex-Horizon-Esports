import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type StringSelectMenuInteraction,
} from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { actorMatches } from "../../lib/command-access.js";
import { botCommandIdFor } from "../../lib/register-slash.js";
import { buildAboutContainer } from "./about.js";
import { buildHelpContainer, normalizeHelpPage } from "./help.js";
import { buildPingContainer } from "./ping.js";
import { HELP_JUMP_ID, helpArrows, panelMessage, type BotPanel, type BotViewContext } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

function botAccessDenied(panel: BotPanel) {
  const who =
    panel === "help"
      ? "You need **Admin**, **Organiser**, a tournament **helper** role, or the **staff** role to open help."
      : "You need **Admin**, **Organiser**, or a tournament **helper** role to open this panel.";
  return { content: who, flags: MessageFlags.Ephemeral } as const;
}

async function canOpenBotPanel(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  panel: BotPanel,
): Promise<boolean> {
  if (panel === "help") {
    return actorMatches(interaction, { admin: true, organiser: true, helper: true, staff: true });
  }
  return actorMatches(interaction, { admin: true, organiser: true, helper: true });
}

async function buildPanel(panel: BotPanel, ctx: BotViewContext) {
  if (panel === "about") {
    return panelMessage("about", await buildAboutContainer(ctx));
  }
  if (panel === "help") {
    const page = normalizeHelpPage(ctx.helpPage);
    return panelMessage("help", buildHelpContainer({ ...ctx, helpPage: page }), helpArrows(page));
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
  if (!(await canOpenBotPanel(interaction, panel))) {
    await interaction.reply(botAccessDenied(panel));
    return;
  }
  await interaction.reply(
    await buildPanel(panel, {
      client,
      createdTimestamp: interaction.createdTimestamp,
      guildId: interaction.guildId,
      commandId: botCommandIdFor(interaction.guildId) ?? interaction.commandId,
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

  if (!(await canOpenBotPanel(interaction, panel))) {
    await interaction.reply(botAccessDenied(panel));
    return;
  }

  await interaction.update(
    await buildPanel(panel, {
      client,
      createdTimestamp: interaction.createdTimestamp,
      guildId: interaction.guildId,
      commandId: botCommandIdFor(interaction.guildId),
      helpPage,
    }),
  );
}

/** Help's "Jump to a section" menu. */
export async function handleBotSelect(interaction: StringSelectMenuInteraction, client: Client): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }
  if (interaction.customId !== HELP_JUMP_ID) {
    return;
  }
  if (!(await canOpenBotPanel(interaction, "help"))) {
    await interaction.reply(botAccessDenied("help"));
    return;
  }

  await interaction.update(
    await buildPanel("help", {
      client,
      createdTimestamp: interaction.createdTimestamp,
      guildId: interaction.guildId,
      commandId: botCommandIdFor(interaction.guildId),
      helpPage: normalizeHelpPage(Number(interaction.values[0])),
    }),
  );
}
