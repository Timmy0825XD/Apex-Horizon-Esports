import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type Message,
  type MessageCreateOptions,
} from "discord.js";
import { v2Flags } from "../../lib/v2.js";
import { attendanceError } from "./view.js";

export type ButtonView = {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

function freeze(rows: ActionRowBuilder<ButtonBuilder>[]): ActionRowBuilder<ButtonBuilder>[] {
  return rows.map((row) => {
    const copy = new ActionRowBuilder<ButtonBuilder>();
    for (const component of row.components) {
      copy.addComponents(ButtonBuilder.from(component).setDisabled(true));
    }
    return copy;
  });
}

export async function watchButtons(
  interaction: ChatInputCommandInteraction,
  message: Message,
  initial: ActionRowBuilder<ButtonBuilder>[],
  onPress: (customId: string) => ButtonView,
): Promise<void> {
  let latest = initial;
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
    latest = next.components;
    await button.update({ embeds: next.embeds, components: next.components, allowedMentions: { parse: [] } }).catch(() => undefined);
  });
  collector.on("end", async () => {
    if (latest.length === 0) {
      return;
    }
    await interaction.editReply({ components: freeze(latest) }).catch(() => undefined);
  });
}

export async function watchSalaryButtons(
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
