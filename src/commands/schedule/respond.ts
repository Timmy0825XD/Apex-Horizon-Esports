import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";

export function scheduleNotice(kind: "error" | "success" | "info", title: string, body: string): InteractionReplyOptions {
  const emoji = kind === "error" ? emojis.error : kind === "success" ? emojis.success : emojis.info;
  return {
    content: `${emoji} **${title}**\n${body}`,
    allowedMentions: { parse: [] },
  };
}

export async function replySchedule(interaction: ChatInputCommandInteraction, payload: InteractionReplyOptions): Promise<void> {
  const allowedMentions = payload.allowedMentions ?? { parse: [] };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: payload.content ?? null,
      embeds: payload.embeds ?? [],
      components: payload.components ?? [],
      allowedMentions,
    });
    return;
  }
  await interaction.reply({ ...payload, allowedMentions });
}
