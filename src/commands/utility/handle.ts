import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction, type ModalSubmitInteraction } from "discord.js";
import { isAllowedGuild } from "../../lib/allowed-guilds.js";
import { handleClear, handleClearCategory, handleClearCategoryButton } from "./clear.js";
import { handleEmbedButton, handleEmbedCreate, handleEmbedEdit, handleEmbedModal } from "./embed.js";
import { handleEmojiSteal } from "./emoji-steal.js";
import {
  handleAvatar,
  handleDiscordTag,
  handleEnlarge,
  handleRandom,
  handleToss,
  handleUtc,
} from "./tools.js";
import { handleV2Button, handleV2Create, handleV2Edit, handleV2Modal } from "./v2-builder.js";
import { utilityError } from "./view.js";

const unauthorized = {
  content: "This server is not authorized to use this bot.",
  flags: MessageFlags.Ephemeral,
} as const;

export async function handleUtilitySlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(utilityError("Guild only", "This command can only be used in a server."));
    return;
  }

  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case "clear":
      await handleClear(interaction, guild);
      return;
    case "clear_category":
      await handleClearCategory(interaction, guild);
      return;
    case "emoji_steal":
      await handleEmojiSteal(interaction, guild);
      return;
    case "random":
      await handleRandom(interaction);
      return;
    case "utc":
      await handleUtc(interaction);
      return;
    case "discord_tag":
      await handleDiscordTag(interaction);
      return;
    case "avatar":
      await handleAvatar(interaction, guild);
      return;
    case "toss":
      await handleToss(interaction);
      return;
    case "enlarge":
      await handleEnlarge(interaction);
      return;
    case "embed":
      await handleEmbedCreate(interaction, guild);
      return;
    case "edit_embed":
      await handleEmbedEdit(interaction, guild);
      return;
    case "v2":
      await handleV2Create(interaction, guild);
      return;
    case "edit_v2":
      await handleV2Edit(interaction, guild);
  }
}

export async function handleUtilityButton(interaction: ButtonInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const id = interaction.customId;
  if (id.startsWith("utility:cat:")) {
    await handleClearCategoryButton(interaction);
    return;
  }
  if (id.startsWith("utility:eb:")) {
    await handleEmbedButton(interaction);
    return;
  }
  if (id.startsWith("utility:v2:")) {
    await handleV2Button(interaction);
  }
}

export async function handleUtilityModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!isAllowedGuild(interaction.guildId)) {
    await interaction.reply(unauthorized);
    return;
  }

  const id = interaction.customId;
  if (id.startsWith("utility:eb:m:")) {
    await handleEmbedModal(interaction);
    return;
  }
  if (id.startsWith("utility:v2:m:")) {
    await handleV2Modal(interaction);
  }
}
