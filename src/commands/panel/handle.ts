import {
  ContainerBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { actorMatches } from "../../lib/command-access.js";
import { embedColors } from "../../lib/embeds.js";
import { slashMention, subcommandPath } from "../../lib/register-slash.js";
import { textBlock, v2Flags } from "../../lib/v2.js";
import { buildGuideContainer } from "./guide-view.js";
import {
  buildExpiredPanel,
  buildTutorialPanel,
  clearQueue,
  closeSession,
  openSession,
  pickCommands,
  pickFamily,
  touchSession,
  TUTORIAL_IDS,
} from "./tutorial.js";

type PanelInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

const adminOnly = {
  content: "You need **Admin** to use the staff guide panels.",
  flags: MessageFlags.Ephemeral,
} as const;

/** `context/commands/access.md`: `/panel tutorial` is Admin only. */
async function canUsePanel(interaction: PanelInteraction): Promise<boolean> {
  return actorMatches(interaction, { admin: true });
}

async function guard(interaction: PanelInteraction): Promise<boolean> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return false;
  }
  if (!(await canUsePanel(interaction))) {
    await interaction.reply(adminOnly);
    return false;
  }
  return true;
}

export async function handlePanelSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await guard(interaction)) || !interaction.guildId) {
    return;
  }
  if (subcommandPath(interaction) !== "tutorial") {
    return;
  }
  if (!interaction.channel?.isSendable()) {
    await interaction.reply({
      content: "I can't post in this channel. Run the command in a text channel where I can send messages.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const session = openSession(interaction.guildId, interaction.user.id);
  await interaction.reply({
    ...buildTutorialPanel(session, interaction.guildId),
    flags: [...v2Flags, MessageFlags.Ephemeral],
  });
}

export async function handlePanelSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!(await guard(interaction)) || !interaction.guildId) {
    return;
  }
  const session = touchSession(interaction.guildId, interaction.user.id);
  if (!session) {
    await interaction.update(buildExpiredPanel());
    return;
  }
  if (interaction.customId === TUTORIAL_IDS.family) {
    pickFamily(session, Number(interaction.values[0]));
  } else if (interaction.customId === TUTORIAL_IDS.commands) {
    pickCommands(session, interaction.values);
  } else {
    return;
  }
  await interaction.update(buildTutorialPanel(session, interaction.guildId));
}

export async function handlePanelButton(interaction: ButtonInteraction): Promise<void> {
  if (!(await guard(interaction)) || !interaction.guildId) {
    return;
  }
  const guildId = interaction.guildId;
  const session = touchSession(guildId, interaction.user.id);
  if (!session) {
    await interaction.update(buildExpiredPanel());
    return;
  }

  if (interaction.customId === TUTORIAL_IDS.clear) {
    clearQueue(session);
    await interaction.update(buildTutorialPanel(session, guildId));
    return;
  }

  if (interaction.customId === TUTORIAL_IDS.cancel) {
    closeSession(guildId, interaction.user.id);
    await interaction.deferUpdate();
    await interaction.deleteReply().catch(() => undefined);
    return;
  }

  if (interaction.customId !== TUTORIAL_IDS.send || session.queue.length === 0) {
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isSendable()) {
    await interaction.reply({
      content: "I can't post in this channel anymore. Check my permissions and press Send again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const queue = [...session.queue];
  closeSession(guildId, interaction.user.id);
  await interaction.deferUpdate();
  await interaction.deleteReply().catch(() => undefined);

  const failed: string[] = [];
  for (const [index, slash] of queue.entries()) {
    const container = buildGuideContainer(slash, guildId, { index, total: queue.length });
    if (!container) {
      failed.push(slash);
      continue;
    }
    try {
      await channel.send({ flags: v2Flags, components: [container], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error(`Staff guide for /${slash} could not be posted`, error);
      failed.push(slash);
    }
  }

  if (failed.length > 0) {
    const list = failed.map((slash) => `- ${slashMention(guildId, slash)}`).join("\n");
    const container = new ContainerBuilder()
      .setAccentColor(embedColors.error)
      .addTextDisplayComponents(
        textBlock(`## ${emojis.error} Some Guides Were Not Posted`),
        textBlock(
          `${queue.length - failed.length} of ${queue.length} guides reached the channel. These are missing:\n${list}`,
        ),
        textBlock("-# Check that I can send messages here, then pick the missing ones again."),
      );
    await interaction
      .followUp({ flags: [...v2Flags, MessageFlags.Ephemeral], components: [container] })
      .catch(() => undefined);
  }
}
