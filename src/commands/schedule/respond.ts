import { ContainerBuilder, type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { textBlock, v2Flags } from "../../lib/v2.js";

export function scheduleNotice(kind: "error" | "success" | "info", title: string, body: string): InteractionReplyOptions {
  const color = kind === "error" ? embedColors.error : kind === "success" ? embedColors.success : embedColors.info;
  const emoji = kind === "error" ? emojis.error : kind === "success" ? emojis.success : emojis.info;
  return {
    flags: v2Flags,
    components: [
      new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(textBlock(`# ${emoji} ${title}`), textBlock(body)),
    ],
    allowedMentions: { parse: [] },
  };
}

export async function replySchedule(interaction: ChatInputCommandInteraction, payload: InteractionReplyOptions): Promise<void> {
  const body: InteractionReplyOptions = {
    ...payload,
    allowedMentions: payload.allowedMentions ?? { parse: [] },
  };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: payload.content,
      components: payload.components,
      embeds: payload.embeds,
      allowedMentions: payload.allowedMentions ?? { parse: [] },
      flags: payload.components ? v2Flags : undefined,
    });
    return;
  }
  await interaction.reply(body);
}
