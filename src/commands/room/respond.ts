import { MessageFlags, type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";
import { v2Flags } from "../../lib/v2.js";

export async function deferRoom(interaction: ChatInputCommandInteraction, ephemeral = true): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
  }
}

export async function respondRoom(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  const body = {
    content: payload.content ?? null,
    components: payload.components,
    allowedMentions: payload.allowedMentions ?? { parse: [] },
    flags: v2Flags,
  };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(body);
    return;
  }
  await interaction.reply(payload);
}
