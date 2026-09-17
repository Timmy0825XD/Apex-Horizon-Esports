import { ContainerBuilder, MessageFlags, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { textBlock, v2Flags } from "../../lib/v2.js";

export function serverErrorMessage(
  title: string,
  description: string,
  ephemeral = true,
): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.error)
        .addTextDisplayComponents(textBlock(`# ${emojis.error} ${title}`), textBlock(description)),
    ],
  };
}

export function serverInfoMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addTextDisplayComponents(textBlock(`# ${emojis.info} ${title}`), textBlock(description)),
    ],
  };
}

export function serverSuccessMessage(title: string, description: string, ephemeral = true): InteractionReplyOptions {
  return {
    flags: ephemeral ? [...v2Flags, MessageFlags.Ephemeral] : v2Flags,
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(textBlock(`# ${emojis.success} ${title}`), textBlock(description)),
    ],
  };
}
