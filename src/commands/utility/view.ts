import {
  ContainerBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { textBlock, v2Flags } from "../../lib/v2.js";

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

export function utilityError(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return panel(embedColors.error, `${emojis.error} ${title}`, description, ephemeral);
}

export function utilityInfo(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return panel(embedColors.info, `${emojis.info} ${title}`, description, ephemeral);
}

export function utilitySuccess(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return panel(embedColors.success, `${emojis.success} ${title}`, description, ephemeral);
}
