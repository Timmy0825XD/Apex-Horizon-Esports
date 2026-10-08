import { MessageFlags, type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";

export async function deferHidden(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
}

export async function deferPublic(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
}

export async function editAttendance(interaction: ChatInputCommandInteraction, payload: InteractionReplyOptions): Promise<void> {
  await interaction.editReply({
    content: payload.content ?? null,
    embeds: payload.embeds ?? [],
    components: payload.components ?? [],
    files: payload.files ?? [],
    allowedMentions: payload.allowedMentions ?? { parse: [] },
  });
}
