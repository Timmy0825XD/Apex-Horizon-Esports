import {
  ActionRowBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionEditReplyOptions,
  type MessageCreateOptions,
  type ModalSubmitInteraction,
  type NewsChannel,
  type TextChannel,
} from "discord.js";
import { Prisma, type GuildSettings, type StaffInfo } from "@prisma/client";
import { emojis } from "../../emojis.js";
import { actorMatches } from "../../lib/command-access.js";
import { embedColors } from "../../lib/embeds.js";
import { formatChannel, formatHelpEntry, formatRole, formatUser } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { staffCommandIdFor } from "../../lib/register-slash.js";
import { divider, headingWithThumbnail, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { gameKey, isHexGameId } from "../sheet/validate.js";
import { auditStaffInfo } from "./audit.js";
import { roleFields, type StaffInput } from "./fields.js";
import { loadGuildStaffState } from "./store.js";
import { staffErrorMessage } from "./view.js";

export type StaffInfoMode = "add" | "edit";

export const STAFF_INFO_MODAL_PREFIX = "staff:info:";
const GAME_NAME_MAX = 32;

type InfoGuard =
  | {
      ok: true;
      settings: GuildSettings;
      staff: StaffInput;
      existing: StaffInfo | null;
    }
  | { ok: false; title: string; description: string };

async function guardInfo(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  guild: Guild,
  mode: StaffInfoMode,
): Promise<InfoGuard> {
  const commandId = staffCommandIdFor(guild.id);
  const { settings, staff } = await loadGuildStaffState(guild.id);
  if (!settings || !staff) {
    return {
      ok: false,
      title: "Staff config not set",
      description: `An **Admin** has to run ${formatHelpEntry("staff config set", commandId)} before staff can register their info.`,
    };
  }
  if (!(await actorMatches(interaction, { staff: true }))) {
    return { ok: false, title: "Staff only", description: `You need the ${formatRole(guild, staff.staffRoleId)} role to register staff info.` };
  }
  const existing = await prisma.staffInfo.findUnique({
    where: { guildId_userId: { guildId: guild.id, userId: interaction.user.id } },
  });
  if (mode === "add" && existing) {
    return {
      ok: false,
      title: "You already registered your info",
      description: `Your game ID is \`${existing.gameId}\`. Use ${formatHelpEntry("staff info edit", commandId)} to change it.`,
    };
  }
  if (mode === "edit" && !existing) {
    return {
      ok: false,
      title: "No info registered yet",
      description: `Use ${formatHelpEntry("staff info add", commandId)} to register your game ID and game name first.`,
    };
  }

  return { ok: true, settings, staff, existing };
}

function infoModal(mode: StaffInfoMode, existing: StaffInfo | null): ModalBuilder {
  const gameId = new TextInputBuilder()
    .setCustomId("game_id")
    .setLabel("Game ID")
    .setPlaceholder("8–16 hex characters, e.g. 7F3A9C21")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(8)
    .setMaxLength(24);
  const gameName = new TextInputBuilder()
    .setCustomId("game_name")
    .setLabel("Game Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(GAME_NAME_MAX);
  if (existing) {
    gameId.setValue(existing.gameId);
    gameName.setValue(existing.gameName);
  }

  return new ModalBuilder()
    .setCustomId(`${STAFF_INFO_MODAL_PREFIX}${mode}`)
    .setTitle(mode === "add" ? "Register staff info" : "Edit staff info")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(gameId),
      new ActionRowBuilder<TextInputBuilder>().addComponents(gameName),
    );
}

/** `/staff info add` and `/staff info edit`: guards, then the modal. */
export async function handleStaffInfoOpen(
  interaction: ChatInputCommandInteraction,
  mode: StaffInfoMode,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(staffErrorMessage("Guild only", "This command can only be used in a server."));
    return;
  }

  const guard = await guardInfo(interaction, guild, mode);
  if (!guard.ok) {
    await interaction.reply(staffErrorMessage(guard.title, guard.description));
    return;
  }

  await interaction.showModal(infoModal(mode, guard.existing));
}

function unix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

async function staffRoleIdsOf(guild: Guild, staff: StaffInput, userId: string): Promise<string[]> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return [];
  }
  return roleFields
    .map((field) => staff[field.key])
    .filter((id): id is string => Boolean(id) && member.roles.cache.has(id as string));
}

function infoCard(guild: Guild, info: StaffInfo, roleIds: string[], avatarUrl: string): MessageCreateOptions {
  const roles =
    roleIds.length > 0 ? roleIds.map((id) => `> ${formatRole(guild, id)}`).join("\n") : "> *No staff roles*";
  const identity = [
    `### ${emojis.id} Discord`,
    `> **ID:** \`${info.userId}\``,
    `> **Tag:** ${escapeDiscord(info.discordTag)}`,
    "",
    `### ${emojis.mw} Game`,
    `> **ID:** \`${info.gameId}\``,
    `> **Name:** ${escapeDiscord(info.gameName)}`,
  ].join("\n");

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.info)
        .addSectionComponents(
          headingWithThumbnail(`## Staff Member Info`, avatarUrl, formatUser(info.userId)),
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(identity))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(textBlock(`### ${emojis.members} Staff Roles\n${roles}`))
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(
          textBlock(`-# Registered <t:${unix(info.createdAt)}:D> · Last update <t:${unix(info.updatedAt)}:R>`),
        ),
    ],
  };
}

/** Posts the card, or rewrites the one already posted. Returns the message id, or null when it failed. */
async function publishCard(
  guild: Guild,
  channelId: string,
  info: StaffInfo,
  payload: MessageCreateOptions,
): Promise<string | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return null;
  }
  const target = channel as TextChannel | NewsChannel;

  if (info.cardMessageId) {
    const message = await target.messages.fetch(info.cardMessageId).catch(() => null);
    if (message) {
      const edited = await message
        .edit({ components: payload.components, allowedMentions: payload.allowedMentions })
        .catch(() => null);
      if (edited) {
        return edited.id;
      }
    }
  }

  const sent = await target.send(payload).catch(() => null);
  return sent?.id ?? null;
}

function successReply(
  guild: Guild,
  mode: StaffInfoMode,
  info: StaffInfo,
  channelId: string,
  posted: boolean,
): InteractionEditReplyOptions {
  const commandId = staffCommandIdFor(guild.id);
  const title = mode === "add" ? "Your staff info is saved" : "Your staff info is updated";
  const where = posted
    ? mode === "add"
      ? `Your card is posted in ${formatChannel(guild, channelId)}.`
      : `Your card in ${formatChannel(guild, channelId)} now shows the new values.`
    : `*I could not post your card in ${formatChannel(guild, channelId)}. Your info is saved; ask an Admin to check my permissions there.*`;
  const next =
    mode === "add" ? `Use ${formatHelpEntry("staff info edit", commandId)} if anything changes.` : "";

  return {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`# ${emojis.success} ${title}`),
          textBlock(
            [`**Game ID:** \`${info.gameId}\``, `**Game Name:** **${escapeDiscord(info.gameName)}**`].join("\n"),
          ),
          textBlock([where, next].filter(Boolean).join("\n")),
        ),
    ],
  };
}

async function replyError(interaction: ModalSubmitInteraction, title: string, description: string): Promise<void> {
  const { components } = staffErrorMessage(title, description);
  await interaction.editReply({ flags: v2Flags, components, allowedMentions: { parse: [] } });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Modal submit for `/staff info add` and `/staff info edit`. */
export async function handleStaffInfoModal(interaction: ModalSubmitInteraction): Promise<void> {
  const guild = interaction.guild;
  const mode = interaction.customId.slice(STAFF_INFO_MODAL_PREFIX.length);
  if (!guild || (mode !== "add" && mode !== "edit")) {
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guard = await guardInfo(interaction, guild, mode);
  if (!guard.ok) {
    await replyError(interaction, guard.title, guard.description);
    return;
  }

  const gameId = gameKey(interaction.fields.getTextInputValue("game_id"));
  const gameName = interaction.fields.getTextInputValue("game_name").trim();
  if (!isHexGameId(gameId)) {
    await replyError(interaction, "Invalid game ID", "The game ID has to be **8–16** hex characters (`0-9`, `A-F`).");
    return;
  }
  if (!gameName) {
    await replyError(interaction, "Game name required", "Write the name you use in game.");
    return;
  }

  const before = guard.existing;
  if (before && before.gameId === gameId && before.gameName === gameName) {
    await replyError(interaction, "No changes", "Both values already match your registered info.");
    return;
  }

  const owner = await prisma.staffInfo.findUnique({
    where: { guildId_gameId: { guildId: guild.id, gameId } },
    select: { userId: true },
  });
  if (owner && owner.userId !== interaction.user.id) {
    await replyError(
      interaction,
      "Game ID already registered",
      `\`${gameId}\` belongs to ${formatUser(owner.userId)}. Check the ID and try again.`,
    );
    return;
  }

  const data = { discordTag: interaction.user.username, gameId, gameName };
  let saved: StaffInfo;
  try {
    saved = before
      ? await prisma.staffInfo.update({ where: { id: before.id }, data })
      : await prisma.staffInfo.create({ data: { guildId: guild.id, userId: interaction.user.id, ...data } });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    await replyError(
      interaction,
      "Info changed meanwhile",
      "Someone saved the same game ID, or your info was saved twice. Run the command again.",
    );
    return;
  }

  const roleIds = await staffRoleIdsOf(guild, guard.staff, interaction.user.id);
  const card = infoCard(guild, saved, roleIds, interaction.user.displayAvatarURL({ size: 256 }));
  const messageId = await publishCard(guild, guard.staff.staffDetailsChannelId, saved, card);
  if (messageId && messageId !== saved.cardMessageId) {
    saved = await prisma.staffInfo.update({ where: { id: saved.id }, data: { cardMessageId: messageId } });
  }

  await interaction.editReply(successReply(guild, mode, saved, guard.staff.staffDetailsChannelId, messageId != null));
  await auditStaffInfo(interaction, guild, guard.settings, before, saved);
}
