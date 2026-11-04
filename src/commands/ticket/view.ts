import { ContainerBuilder, MessageFlags, type Guild, type InteractionReplyOptions } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatCategory, formatHelpEntry, formatUser } from "../../lib/formatters.js";
import { roomCommandIdFor, ticketCommandIdFor } from "../../lib/register-slash.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord, stageLabel } from "../room/labels.js";

export type TicketAction = "closed" | "reopened" | "deleted" | "already-closed" | "already-open";

export type TicketMatchFace = {
  group: string | null;
  round: number;
  player1Name: string;
  player2Name: string;
} | null;

/** `/ticket close · reopen · delete` replies inside a battle ticket. */
export function ticketActionMessage(input: {
  action: TicketAction;
  guild: Guild;
  tournamentName: string;
  matchId: number;
  match: TicketMatchFace;
  categoryId?: string;
  actorId: string;
}): InteractionReplyOptions {
  const { guild } = input;
  const category = input.categoryId ? formatCategory(guild, input.categoryId) : "its category";
  const reopen = formatHelpEntry("ticket reopen", ticketCommandIdFor(guild.id));
  const close = formatHelpEntry("ticket close", ticketCommandIdFor(guild.id));
  const create = formatHelpEntry("room create", roomCommandIdFor(guild.id));
  const at = `<t:${Math.floor(Date.now() / 1000)}:F>`;
  const copy = {
    closed: {
      color: embedColors.success,
      title: `${emojis.success} Ticket Closed`,
      body: `${emojis.categories} Moved to ${category}. Chat is read-only until someone reopens it.`,
      footer: `Closed by ${formatUser(input.actorId)} · ${at} · undo with ${reopen}`,
    },
    reopened: {
      color: embedColors.success,
      title: `${emojis.success} Ticket Reopened`,
      body: `${emojis.categories} Back in ${category}. Chat access is restored.`,
      footer: `Reopened by ${formatUser(input.actorId)} · ${at} · close it again with ${close}`,
    },
    deleted: {
      color: embedColors.error,
      title: `${emojis.error} Ticket Deleted`,
      body: `${emojis.channels} The channel is gone. That match can get a new ticket with ${create}.`,
      footer: `Deleted by ${formatUser(input.actorId)} · ${at}`,
    },
    "already-closed": {
      color: embedColors.info,
      title: `${emojis.info} Ticket Already Closed`,
      body: `${emojis.categories} This battle ticket is already read-only in a closed category.`,
      footer: `Reopen it with ${reopen}`,
    },
    "already-open": {
      color: embedColors.info,
      title: `${emojis.info} Ticket Already Open`,
      body: `${emojis.categories} This battle ticket is already in an open category.`,
      footer: `Close it with ${close}`,
    },
  }[input.action];

  const stage = input.match ? stageLabel(input.match) : null;
  const heading = stage ? `## ${copy.title}\n-# ${stage}` : `## ${copy.title}`;
  const face = input.match
    ? `${emojis.vs} **${escapeDiscord(input.match.player1Name)}** vs **${escapeDiscord(input.match.player2Name)}**`
    : `${emojis.vs} Match \`${input.matchId}\``;

  const container = new ContainerBuilder()
    .setAccentColor(copy.color)
    .addTextDisplayComponents(
      textBlock(heading),
      textBlock(`${face}\n${emojis.torneo} **${escapeDiscord(input.tournamentName)}**`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(copy.body))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(`-# ${copy.footer}`));

  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: [container],
  };
}
