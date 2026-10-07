import { MessageFlags, type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";
import { v2Flags } from "../../lib/v2.js";

function usesV2(payload: InteractionReplyOptions): boolean {
  const flags = payload.flags;
  if (flags == null) {
    return false;
  }
  if (typeof flags === "number") {
    return (flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2;
  }
  if (Array.isArray(flags)) {
    return flags.includes(MessageFlags.IsComponentsV2);
  }
  return false;
}

export async function deferBracket(interaction: ChatInputCommandInteraction, ephemeral = false): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
  }
}

export async function respondBracket(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
): Promise<void> {
  const allowedMentions = payload.allowedMentions ?? { parse: [] };
  const v2 = usesV2(payload);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: v2 ? null : (payload.content ?? null),
      embeds: v2 ? [] : (payload.embeds ?? []),
      components: payload.components ?? [],
      allowedMentions,
      flags: v2 ? v2Flags : undefined,
    });
    return;
  }
  await interaction.reply({ ...payload, allowedMentions });
}
