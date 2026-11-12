import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  type Guild,
  type InteractionReplyOptions,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatCategory, formatChannel, formatHelpEntry, formatUser } from "../../lib/formatters.js";
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

function matchHeading(title: string, input: { tournamentName: string; matchId: number; match: TicketMatchFace }): string[] {
  const stage = input.match ? stageLabel(input.match) : null;
  const face = input.match
    ? `${emojis.vs} **${escapeDiscord(input.match.player1Name)}** vs **${escapeDiscord(input.match.player2Name)}**`
    : `${emojis.vs} Match \`${input.matchId}\``;
  return [
    stage ? `## ${title}\n-# ${stage}` : `## ${title}`,
    `${face}\n${emojis.torneo} **${escapeDiscord(input.tournamentName)}**`,
  ];
}

/** `/ticket transcript` reply: where the new transcript is and what was replaced. */
export function transcriptRegeneratedMessage(input: {
  guild: Guild;
  tournamentName: string;
  matchId: number;
  match: TicketMatchFace;
  transcriptChannelId: string;
  transcriptUrl: string;
  removed: number;
  oldFound: number;
  results: "updated" | "failed" | "none";
  relinked: { updated: number; failed: number };
  actorId: string;
}): InteractionReplyOptions {
  const plural = (count: number, one: string, many: string) => `**${count}** ${count === 1 ? one : many}`;
  const lines = [`${emojis.transcript} New transcript posted in ${formatChannel(input.guild, input.transcriptChannelId)}.`];
  if (input.oldFound === 0) {
    lines.push("- No earlier transcript of this ticket was found.");
  } else {
    lines.push(`- Old transcript removed: ${plural(input.removed, "post", "posts")}.`);
    if (input.removed < input.oldFound) {
      lines.push(`- ${plural(input.oldFound - input.removed, "old post", "old posts")} could not be deleted. Remove it by hand.`);
    }
  }
  if (input.results === "updated") {
    lines.push("- The result posts now link to the new transcript.");
  } else if (input.results === "failed") {
    lines.push("- The result posts could not be relinked.");
  }
  if (input.relinked.updated > 0) {
    lines.push(`- ${plural(input.relinked.updated, "message", "messages")} in this ticket now point to the new transcript.`);
  }
  if (input.relinked.failed > 0) {
    lines.push(`- ${plural(input.relinked.failed, "message", "messages")} in this ticket kept the old link.`);
  }
  const clean = input.removed === input.oldFound && input.results !== "failed" && input.relinked.failed === 0;
  const title = clean ? `${emojis.success} Transcript Regenerated` : `${emojis.info} Transcript Regenerated`;
  const [heading, face] = matchHeading(title, input);
  const container = new ContainerBuilder()
    .setAccentColor(clean ? embedColors.success : 0xe67e22)
    .addTextDisplayComponents(textBlock(heading), textBlock(face))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(lines.join("\n")))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open transcript").setURL(input.transcriptUrl),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(`-# Regenerated by ${formatUser(input.actorId)} · <t:${Math.floor(Date.now() / 1000)}:F>`),
    );
  return {
    flags: [...v2Flags, MessageFlags.Ephemeral],
    allowedMentions: { parse: [] },
    components: [container],
  };
}
