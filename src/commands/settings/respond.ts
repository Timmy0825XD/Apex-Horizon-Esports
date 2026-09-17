import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { v2Flags } from "../../lib/v2.js";

export async function deferSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
}

export async function respondSettings(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: payload.content,
      components: payload.components,
      flags: v2Flags,
    });
    return;
  }

  await interaction.reply(payload);
}
