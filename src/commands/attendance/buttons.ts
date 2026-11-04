import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  type MessageCreateOptions,
} from "discord.js";
import { v2Flags } from "../../lib/v2.js";
import { attendanceError } from "./view.js";

/** Repaints a V2 panel on each press by its owner for 2 minutes, then paints it with the buttons locked. */
export async function watchPanelButtons(
  interaction: ChatInputCommandInteraction,
  message: Message,
  onPress: (customId: string) => MessageCreateOptions,
  onEnd: () => MessageCreateOptions,
): Promise<void> {
  const collector = message.createMessageComponentCollector({ time: 120_000 });
  collector.on("collect", async (button: ButtonInteraction) => {
    if (button.user.id !== interaction.user.id) {
      await button
        .reply({
          embeds: [attendanceError("Not your menu", "Only the person who ran the command can use these buttons.")],
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => undefined);
      return;
    }
    const next = onPress(button.customId);
    await button
      .update({
        content: null,
        embeds: [],
        components: next.components,
        flags: v2Flags,
        allowedMentions: { parse: [] },
      })
      .catch(() => undefined);
  });
  collector.on("end", async () => {
    const next = onEnd();
    await interaction
      .editReply({
        content: null,
        embeds: [],
        components: next.components,
        flags: v2Flags,
        allowedMentions: { parse: [] },
      })
      .catch(() => undefined);
  });
}
