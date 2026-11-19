import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  type InteractionEditReplyOptions,
  type Message,
} from "discord.js";
import { v2Flags } from "../../lib/v2.js";

/**
 * Team cards mention captains and players without pinging them. With `parse: []` Discord does not attach
 * those users, so members the reader has not cached show as "@unknown-user". Edits never notify, so each
 * card's mentions are allowed on edit: the first card is an edit of the deferred reply, and every
 * follow-up card gets one silent edit if Discord left a mention unresolved. Only `/team list` does this,
 * because that edit shows "(edited)" under the message.
 */
const USER_MENTION = /<@!?(\d{17,20})>/g;
const MAX_USERS = 100;
const RESOLVE_DELAY_MS = 1500;

function mentionedUsers(payload: InteractionReplyOptions): string[] {
  const text = JSON.stringify([payload.content ?? "", payload.components ?? []]);
  return [...new Set([...text.matchAll(USER_MENTION)].flatMap((match) => (match[1] ? [match[1]] : [])))].slice(
    0,
    MAX_USERS,
  );
}

function editBody(payload: InteractionReplyOptions, users: string[]): InteractionEditReplyOptions {
  return {
    content: payload.content,
    components: payload.components,
    embeds: payload.embeds,
    files: payload.files,
    allowedMentions: users.length > 0 ? { parse: [], users } : payload.allowedMentions,
    flags: payload.components ? v2Flags : undefined,
  } as InteractionEditReplyOptions;
}

export async function deferTeam(interaction: ChatInputCommandInteraction, ephemeral = false): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
  }
}

export async function respondTeam(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
  resolveMentions = false,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(editBody(payload, resolveMentions ? mentionedUsers(payload) : []));
    return;
  }

  await interaction.reply(payload);
}

export async function followTeam(
  interaction: ChatInputCommandInteraction,
  payload: InteractionReplyOptions,
  resolveMentions = false,
): Promise<void> {
  const message = await interaction.followUp({
    content: payload.content,
    components: payload.components,
    embeds: payload.embeds,
    files: payload.files,
    allowedMentions: payload.allowedMentions,
    flags: payload.components ? v2Flags : undefined,
  });
  if (resolveMentions) {
    scheduleResolve(interaction, message, payload);
  }
}

function scheduleResolve(interaction: ChatInputCommandInteraction, message: Message, payload: InteractionReplyOptions): void {
  const users = mentionedUsers(payload);
  if (users.every((id) => message.mentions.users.has(id))) {
    return;
  }
  setTimeout(() => {
    void interaction.webhook.editMessage(message, editBody(payload, users)).catch(() => undefined);
  }, RESOLVE_DELAY_MS);
}
