import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";
import { MessageFlags } from "discord.js";
import { v2Flags } from "../../lib/v2.js";

export async function deferStaff(
  interaction: ChatInputCommandInteraction,
  ephemeral = false,
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
  }
}

export async function respondStaff(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: payload.content,
      components: payload.components,
      embeds: payload.embeds,
      files: payload.files,
      allowedMentions: payload.allowedMentions,
      flags: payload.components ? v2Flags : undefined,
    });
    return;
  }

  await interaction.reply(payload);
}
