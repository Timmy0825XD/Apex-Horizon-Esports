import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { customEmoji } from "../../lib/custom-emoji.js";
import { embedColors } from "../../lib/embeds.js";
import { formatUser } from "../../lib/formatters.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";

export async function deferUtility(interaction: ChatInputCommandInteraction, ephemeral = false): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
  }
}

export function asMessageEdit(payload: InteractionReplyOptions): InteractionEditReplyOptions & InteractionUpdateOptions {
  return {
    content: payload.content,
    components: payload.components,
    embeds: payload.embeds,
    files: payload.files,
    allowedMentions: payload.allowedMentions,
    flags: payload.components ? v2Flags : undefined,
  };
}

export async function respondUtility(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(asMessageEdit(payload));
    return;
  }

  await interaction.reply(payload);
}

function panel(
  color: number,
  title: string,
  description: string,
  ephemeral: boolean,
): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(textBlock(`# ${title}`), textBlock(description)),
    ],
  };
}

/** `-# Verb by @actor · <t:now:F>` footer used by the utility result cards. */
export function actorFooter(verb: string, actorId: string): string {
  return `-# ${verb} by ${formatUser(actorId)} · <t:${Math.floor(Date.now() / 1000)}:F>`;
}

/** Result card: `##` heading block, body blocks, then a divider and the `-#` footer. Rows go inside the container. */
export function utilityCard(input: {
  color: number;
  heading: string;
  blocks?: string[];
  footer?: string;
  rows?: ActionRowBuilder<ButtonBuilder>[];
  ephemeral: boolean;
}): InteractionReplyOptions {
  const container = new ContainerBuilder()
    .setAccentColor(input.color)
    .addTextDisplayComponents(textBlock(input.heading), ...(input.blocks ?? []).map((block) => textBlock(block)));
  if (input.footer) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(textBlock(input.footer));
  }
  for (const row of input.rows ?? []) {
    container.addActionRowComponents(row);
  }
  return {
    flags: input.ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    allowedMentions: { parse: [] },
    components: [container],
  };
}

/** One link button, e.g. `Jump to message` or `Open full size`. */
export function linkRow(label: string, url: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label).setEmoji(customEmoji(emojis.link)),
  );
}

export function utilityError(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return panel(embedColors.error, `${emojis.error} ${title}`, description, ephemeral);
}

export function utilityInfo(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return panel(embedColors.info, `${emojis.info} ${title}`, description, ephemeral);
}

export function utilitySuccess(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return panel(embedColors.success, `${emojis.success} ${title}`, description, ephemeral);
}
