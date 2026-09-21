import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  type Client,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { helpCatalog } from "./catalog.js";

export { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";

export type BotPanel = "about" | "help" | "ping";

export type BotViewContext = {
  client: Client;
  createdTimestamp: number;
  commandId?: string;
  settingsCommandId?: string;
  serverCommandId?: string;
  staffCommandId?: string;
  tournamentCommandId?: string;
  teamCommandId?: string;
  roleCommandId?: string;
  userCommandId?: string;
  utilityCommandId?: string;
  helpPage?: number;
};

export function botAvatarUrl(client: Client): string | undefined {
  return client.user?.displayAvatarURL({ size: 256 });
}

function navButton(panel: BotPanel, active: BotPanel, label: string, emoji: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`bot:nav:${panel}`)
    .setLabel(label)
    .setStyle(active === panel ? ButtonStyle.Primary : ButtonStyle.Secondary)
    .setEmoji(customEmoji(emoji))
    .setDisabled(active === panel);
}

export function botNavRow(active: BotPanel): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    navButton("about", active, "About", emojis.info),
    navButton("help", active, "Help", emojis.help),
    navButton("ping", active, "Ping", emojis.ping),
  );
}

export function helpPagerRow(page: number): ActionRowBuilder<ButtonBuilder> {
  const last = helpCatalog.length - 1;
  const prev = page <= 0 ? last : page - 1;
  const next = page >= last ? 0 : page + 1;
  const category = helpCatalog[page] ?? helpCatalog[0];

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bot:help:${prev}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back)),
    new ButtonBuilder().setCustomId("bot:help:current").setLabel(category.title).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`bot:help:${next}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next)),
  );
}

export function panelMessage(active: BotPanel, container: ContainerBuilder) {
  container.spliceComponents(0, 0, botNavRow(active), divider());
  return {
    flags: v2Flags,
    components: [container],
  };
}
