import { ContainerBuilder, MessageFlags, type ChatInputCommandInteraction, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { textBlock, v2Flags } from "../../lib/v2.js";

function tone(kind: "error" | "success" | "info"): { emoji: string; color: number } {
  if (kind === "error") {
    return { emoji: emojis.error, color: embedColors.error };
  }
  if (kind === "success") {
    return { emoji: emojis.success, color: embedColors.success };
  }
  return { emoji: emojis.info, color: embedColors.info };
}

export function schedulePlain(kind: "error" | "success" | "info", title: string, body: string): string {
  return `${tone(kind).emoji} **${title}**\n${body}`;
}

export function scheduleNotice(kind: "error" | "success" | "info", title: string, body: string): InteractionReplyOptions {
  const { emoji, color } = tone(kind);
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(textBlock(`# ${emoji} ${title}`), textBlock(body)),
    ],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

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

export async function replySchedule(interaction: ChatInputCommandInteraction, payload: InteractionReplyOptions): Promise<void> {
  const allowedMentions = payload.allowedMentions ?? { parse: [] };
  const v2 = usesV2(payload);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: v2 ? null : (payload.content ?? null),
      embeds: v2 ? [] : (payload.embeds ?? []),
      components: payload.components ?? [],
      files: payload.files,
      allowedMentions,
      flags: v2 ? v2Flags : undefined,
    });
    return;
  }
  await interaction.reply({ ...payload, allowedMentions });
}
