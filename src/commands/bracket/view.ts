import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  type InteractionReplyOptions,
  MessageFlags,
} from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { customEmoji, emojiAssetUrl } from "../../lib/custom-emoji.js";
import { formatChannel, formatUser } from "../../lib/formatters.js";
import { divider, textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord, scoreLine, stageLabel } from "../room/labels.js";

type Tone = "success" | "error" | "info" | "warn";

const warnColor = 0xe67e22;

function toneColor(tone: Tone): number {
  if (tone === "success") {
    return embedColors.success;
  }
  if (tone === "error") {
    return embedColors.error;
  }
  if (tone === "warn") {
    return warnColor;
  }
  return embedColors.info;
}

function toneEmoji(tone: Tone): string {
  if (tone === "success") {
    return emojis.success;
  }
  if (tone === "error") {
    return emojis.error;
  }
  return emojis.info;
}

function linesEmbed(color: number, lines: string[]): EmbedBuilder {
  const [title, ...rest] = lines;
  return new EmbedBuilder().setColor(color).setTitle(title ?? "Bracket").setDescription(rest.filter((line) => line.trim()).join("\n") || null);
}

export function bracketPanel(
  tone: Tone,
  title: string,
  lines: string[],
  ephemeral = true,
): InteractionReplyOptions {
  const body = [title, ...lines.filter((line) => line.trim())];
  return {
    embeds: [linesEmbed(toneColor(tone), [`${toneEmoji(tone)} ${body[0]}`, ...body.slice(1)])],
    flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    allowedMentions: { parse: [] },
  };
}

function v2(container: ContainerBuilder): InteractionReplyOptions {
  return {
    components: [container],
    flags: v2Flags,
    allowedMentions: { parse: [] },
  };
}

function heading(title: string, stage: string | null): string {
  return stage ? `${title}\n-# ${stage}` : title;
}

function headSection(texts: string[], thumbnailEmoji: string): SectionBuilder {
  const section = new SectionBuilder().addTextDisplayComponents(texts.map((text) => textBlock(text)));
  const url = emojiAssetUrl(thumbnailEmoji);
  if (url) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(url));
  }
  return section;
}

function stamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function byline(verb: string, actorId: string, at: Date): string {
  return `-# ${verb} by ${formatUser(actorId)} · ${stamp(at)}`;
}

function quote(text: string): string {
  return `> ${escapeDiscord(text).replace(/\n/g, "\n> ")}`;
}

// ---------- Closing card: /bracket upload and /bracket dq both ----------

export type CloseStep = "pending" | "done" | "failed";

export type CloseProgress = {
  archive: CloseStep;
  transcript: CloseStep;
  transcriptUrl: string | null;
};

export const closeStarted: CloseProgress = { archive: "pending", transcript: "pending", transcriptUrl: null };

function closeFinished(progress: CloseProgress): boolean {
  return progress.archive === "done" && progress.transcript === "done";
}

function closeSteps(scoreLabel: string, progress: CloseProgress, transcriptChannelId: string | null): string {
  const lines = [`${emojis.challonge} **${scoreLabel}** on Challonge`];
  if (progress.archive === "pending") {
    lines.push("-# Archiving the ticket…");
    return lines.join("\n");
  }
  if (progress.archive === "failed") {
    lines.push(`${emojis.error} **Ticket not archived** · close it and generate the transcript by hand`);
    return lines.join("\n");
  }
  lines.push(`${emojis.open_close} **Ticket archived** · moved to the archive category`);
  if (progress.transcript === "pending") {
    lines.push("-# Publishing the transcript…");
  } else if (progress.transcript === "failed") {
    lines.push(`${emojis.error} **Transcript not published** · generate it by hand`);
  } else {
    const where = transcriptChannelId ? ` · ${formatChannel(null, transcriptChannelId)}` : "";
    lines.push(`${emojis.transcript} **Transcript published**${where}`);
  }
  return lines.join("\n");
}

function transcriptRow(url: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setLabel("View transcript")
      .setEmoji(customEmoji(emojis.transcript)),
  );
}

type ClosingCard = {
  tournamentName: string;
  channelId: string;
  stage: string | null;
  leftName: string;
  rightName: string;
  score1: number;
  score2: number;
  actorId: string;
  at: Date;
  transcriptChannelId: string | null;
  progress: CloseProgress;
};

function matchBlock(input: ClosingCard): string {
  return [
    `### ${scoreLine(input.leftName, input.rightName, input.score1, input.score2)}`,
    `${emojis.torneo} **${escapeDiscord(input.tournamentName)}** · ${formatChannel(null, input.channelId)}`,
  ].join("\n");
}

function closeFooter(container: ContainerBuilder, input: ClosingCard, scoreLabel: string, verb: string): void {
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(closeSteps(scoreLabel, input.progress, input.transcriptChannelId)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(byline(verb, input.actorId, input.at)));
  if (input.progress.transcriptUrl) {
    container.addActionRowComponents(transcriptRow(input.progress.transcriptUrl));
  }
}

export function matchUpdatedMessage(input: ClosingCard & { note?: string | null }): InteractionReplyOptions {
  const container = new ContainerBuilder()
    .setAccentColor(closeFinished(input.progress) ? embedColors.success : warnColor)
    .addSectionComponents(
      headSection([heading(`## ${emojis.success} Score Uploaded`, input.stage), matchBlock(input)], emojis.challonge),
    );
  const note = input.note?.trim();
  if (note) {
    container.addTextDisplayComponents(textBlock(`**Note**\n${quote(note)}`));
  }
  closeFooter(container, input, "Score saved", "Uploaded");
  return v2(container);
}

export type DisqualifiedForfeit = {
  leftName: string;
  rightName: string;
  score1: number;
  score2: number;
  round: number;
  group: string | null;
};

export function bothDisqualifiedMessage(
  input: ClosingCard & {
    forfeited: DisqualifiedForfeit[];
    stillMarked: boolean;
    forfeitFailed: boolean;
  },
): InteractionReplyOptions {
  const advances = input.score1 > input.score2 ? input.leftName : input.rightName;
  const eliminated = input.score1 > input.score2 ? input.rightName : input.leftName;
  const outcome = [
    `${emojis.winner} **Advances** ${escapeDiscord(advances)} · *forfeits their next match*`,
    `${emojis.banned} **Eliminated** ${escapeDiscord(eliminated)}`,
  ];
  if (input.stillMarked) {
    outcome.push("-# Their next match is forfeited once both sides are set, and that ticket is not opened.");
  }

  const container = new ContainerBuilder()
    .setAccentColor(embedColors.error)
    .addSectionComponents(
      headSection([heading(`## ${emojis.banned} Both Sides Disqualified`, input.stage), matchBlock(input)], emojis.banned),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(outcome.join("\n")));
  if (input.forfeited.length > 0) {
    const lines = input.forfeited.map((match) => {
      const stage = stageLabel(match);
      const score = scoreLine(match.leftName, match.rightName, match.score1, match.score2);
      return `- ${score}${stage ? ` · ${stage}` : ""}`;
    });
    container.addTextDisplayComponents(textBlock([`${emojis.alert} **Forfeited before a ticket**`, ...lines].join("\n")));
  }
  if (input.forfeitFailed) {
    container.addTextDisplayComponents(
      textBlock(`${emojis.error} The next match could not be forfeited yet. Opening rooms will try again.`),
    );
  }
  closeFooter(container, input, "Scores saved", "Disqualified");
  return v2(container);
}

// ---------- /bracket correct ----------

function scoreText(score1: number | null, score2: number | null): string {
  return score1 != null && score2 != null ? `\`${score1} - ${score2}\`` : "*Unknown*";
}

export function scoreCorrectedMessage(input: {
  tournamentName: string;
  stage: string | null;
  leftName: string;
  rightName: string;
  oldScore1: number | null;
  oldScore2: number | null;
  score1: number;
  score2: number;
  rebuilt: number;
  actorId: string;
  at: Date;
}): InteractionReplyOptions {
  const details = [
    `${emojis.scoreboard} **Before** ${scoreText(input.oldScore1, input.oldScore2)} → **now** ${scoreText(input.score1, input.score2)}`,
  ];
  if (input.rebuilt > 0) {
    const noun = input.rebuilt === 1 ? "ticket" : "tickets";
    details.push(
      `${emojis.alert} **Rooms rebuilt** \`${input.rebuilt}\` ${noun} removed · open matches reopened with the right captains`,
    );
  }
  const container = new ContainerBuilder()
    .setAccentColor(embedColors.success)
    .addSectionComponents(
      headSection(
        [
          heading(`## ${emojis.success} Bracket Corrected`, input.stage),
          [
            `### ${scoreLine(input.leftName, input.rightName, input.score1, input.score2)}`,
            `${emojis.torneo} **${escapeDiscord(input.tournamentName)}**`,
          ].join("\n"),
        ],
        emojis.challonge,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(details.join("\n")))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(textBlock(byline("Corrected", input.actorId, input.at)));
  return v2(container);
}

function simpleCard(color: number, title: string, body: string, footer?: string): InteractionReplyOptions {
  const blocks = [textBlock(`# ${title}`), textBlock(body)];
  if (footer) {
    blocks.push(textBlock(`-# ${footer}`));
  }
  return v2(new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(blocks));
}

export function bracketNotice(tone: Tone, title: string, lines: string[]): InteractionReplyOptions {
  return simpleCard(toneColor(tone), `${toneEmoji(tone)} ${title}`, lines.filter((line) => line.trim()).join("\n"));
}

export function correctionCancelledMessage(actorId: string, at: Date): InteractionReplyOptions {
  return v2(
    new ContainerBuilder()
      .setAccentColor(embedColors.info)
      .addTextDisplayComponents(
        textBlock(
          `## ${emojis.info} Correction Cancelled\nNo tickets were deleted. The bracket and every ticket are unchanged.`,
        ),
        textBlock(byline("Cancelled", actorId, at)),
      ),
  );
}

export type CorrectTicket = {
  channelId: string;
  round: number | null;
  group: string | null;
  leftName: string;
  rightName: string;
  status: string;
};

function ticketLines(tickets: CorrectTicket[]): string {
  const shown = tickets.slice(0, 12);
  const lines = shown.map((ticket) => {
    const status = ticket.status === "closed" ? "Closed" : "Open";
    const stage = stageLabel(ticket) ?? "Round unknown";
    return `- ${formatChannel(null, ticket.channelId)} · ${stage} · **${status}**`;
  });
  const hidden = tickets.length - shown.length;
  if (hidden > 0) {
    lines.push(`*and **${hidden}** more*`);
  }
  return lines.join("\n");
}

export function correctConfirmCustomId(
  action: "ok" | "no",
  userId: string,
  tournamentId: string,
  matchId: number,
  score1: number,
  score2: number,
): string {
  return `bracket:correct:${action}:${userId}:${tournamentId}:${matchId}:${score1}:${score2}`;
}

export function parseCorrectConfirmCustomId(customId: string): {
  action: "ok" | "no";
  userId: string;
  tournamentId: string;
  matchId: number;
  score1: number;
  score2: number;
} | null {
  const parts = customId.split(":");
  if (parts.length !== 8 || parts[0] !== "bracket" || parts[1] !== "correct") {
    return null;
  }
  const action = parts[2];
  if (action !== "ok" && action !== "no") {
    return null;
  }
  const userId = parts[3] ?? "";
  const tournamentId = parts[4] ?? "";
  const matchId = Number(parts[5]);
  const score1 = Number(parts[6]);
  const score2 = Number(parts[7]);
  if (!/^\d{17,20}$/.test(userId) || !/^[a-f0-9]{24}$/i.test(tournamentId)) {
    return null;
  }
  if (![matchId, score1, score2].every((value) => Number.isInteger(value) && value >= 0)) {
    return null;
  }
  return { action, userId, tournamentId, matchId, score1, score2 };
}

export function correctConfirmMessage(input: {
  tournamentName: string;
  stage: string | null;
  leftName: string;
  rightName: string;
  oldScore1: number | null;
  oldScore2: number | null;
  score1: number;
  score2: number;
  winnerName: string;
  tickets: CorrectTicket[];
  userId: string;
  tournamentId: string;
  matchId: number;
}): InteractionReplyOptions {
  const count = input.tickets.length;
  const score =
    input.oldScore1 != null && input.oldScore2 != null
      ? `\`${input.oldScore1} - ${input.oldScore2}\` → \`${input.score1} - ${input.score2}\``
      : `\`${input.score1} - ${input.score2}\``;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(correctConfirmCustomId("ok", input.userId, input.tournamentId, input.matchId, input.score1, input.score2))
      .setLabel("Confirm correction")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(customEmoji(emojis.success)),
    new ButtonBuilder()
      .setCustomId(correctConfirmCustomId("no", input.userId, input.tournamentId, input.matchId, input.score1, input.score2))
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(customEmoji(emojis.error)),
  );

  const container = new ContainerBuilder()
    .setAccentColor(warnColor)
    .addSectionComponents(
      headSection(
        [
          heading(`## ${emojis.alert} Confirm Bracket Correction`, input.stage),
          `The winner of **${escapeDiscord(input.leftName)}** vs **${escapeDiscord(input.rightName)}** changes. Nothing is touched until you confirm.`,
        ],
        emojis.challonge,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          `${emojis.scoreboard} **Score** ${score}`,
          `${emojis.winner} **New winner** ${escapeDiscord(input.winnerName)}`,
          `${emojis.torneo} **${escapeDiscord(input.tournamentName)}**`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [`### ${emojis.textChannel} ${count} ticket${count === 1 ? "" : "s"} will be deleted`, ticketLines(input.tickets)].join(
          "\n",
        ),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      textBlock(
        [
          "### If you confirm",
          "- Those tickets and their schedules are **deleted**.",
          "- Their scores on Challonge are **reset**.",
          "- Matches that open again are **recreated** with the right captains. The rest wait for their round.",
        ].join("\n"),
      ),
      textBlock(`-# Only ${formatUser(input.userId)} can use these buttons.`),
    )
    .addActionRowComponents(row);
  return v2(container);
}
