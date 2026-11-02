import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
  type Client,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { divider, v2Flags } from "../../lib/v2.js";
import { helpCatalog } from "./catalog.js";

export { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";

export type BotPanel = "about" | "help" | "ping";

export type BotViewContext = {
  client: Client;
  guildId?: string | null;
  createdTimestamp: number;
  commandId?: string;
  helpPage?: number;
};

/** Apex Horizon brand colors for the identity panels. Ping uses status colors instead. */
export const brandColors = {
  red: 0xc8102e,
  gold: 0xd4a017,
} as const;

/** Ping status colors: the panel takes the color of its slowest check. */
export const statusColors = {
  good: 0x23a55a,
  slow: 0xf0b232,
  bad: 0xf23f43,
} as const;

export const HELP_JUMP_ID = "bot:help:jump";

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

/** About / Help / Ping, with optional buttons in front (help's page arrows). Max 5 per row. */
function botNavRow(active: BotPanel, leading: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...leading,
    navButton("about", active, "About", emojis.info),
    navButton("help", active, "Help", emojis.help),
    navButton("ping", active, "Ping", emojis.ping),
  );
}

export function helpArrows(page: number): ButtonBuilder[] {
  const last = helpCatalog.length - 1;
  const prev = page <= 0 ? last : page - 1;
  const next = page >= last ? 0 : page + 1;
  return [
    new ButtonBuilder()
      .setCustomId(`bot:help:${prev}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.back)),
    new ButtonBuilder()
      .setCustomId(`bot:help:${next}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.next)),
  ];
}

export function helpJumpRow(page: number): ActionRowBuilder<StringSelectMenuBuilder> {
  const current = helpCatalog[page] ?? helpCatalog[0];
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(HELP_JUMP_ID)
      .setPlaceholder(`Jump to a section · ${current?.title ?? ""} (${page + 1} of ${helpCatalog.length})`)
      .addOptions(
        helpCatalog.map((category, index) => ({
          label: category.title,
          value: String(index),
          description: category.description.slice(0, 100),
        })),
      ),
  );
}

/** Content first, then the navigation row at the bottom of the same container. */
export function panelMessage(active: BotPanel, container: ContainerBuilder, leading: ButtonBuilder[] = []) {
  container.addSeparatorComponents(divider()).addActionRowComponents(botNavRow(active, leading));
  return {
    flags: v2Flags,
    components: [container],
  };
}
