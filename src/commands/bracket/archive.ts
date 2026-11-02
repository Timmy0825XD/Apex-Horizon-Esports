import { MessageFlags, type ChatInputCommandInteraction, type Guild, type TextChannel } from "discord.js";
import { attachResultsTranscript } from "../schedule/results.js";
import { closeTicket } from "../ticket/lifecycle.js";
import { publishTicketTranscript, transcriptFilename } from "../ticket/transcript/index.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { bracketPanel, channelClosedMessage, transcriptGeneratedMessage } from "./view.js";

function archivedChannelName(current: string): string {
  const bare = current.replace(/^[✅🔴]+/u, "").replace(/^-+/, "");
  const next = `✅${bare}`.slice(0, 100).replace(/-+$/g, "");
  return next || "done";
}

/**
 * Rename, close and transcribe a battle ticket after Challonge already took the score.
 * The score stands either way, so a failure here is a warning to finish by hand, not an error.
 */
export async function archiveBattleTicket(input: {
  interaction: ChatInputCommandInteraction;
  guild: Guild;
  ticket: TextChannel;
  tournament: TournamentRecord;
  matchId: number;
  reason: string;
}): Promise<void> {
  const { interaction, guild, ticket, tournament } = input;
  const actorTag = interaction.user.username;
  const nextName = archivedChannelName(ticket.name);
  if (nextName !== ticket.name) {
    await ticket.setName(nextName, input.reason).catch(() => undefined);
  }

  try {
    await closeTicket(ticket, guild, tournament);
  } catch (error) {
    console.error(`Battle ticket close failed for match ${input.matchId}`, error);
    const detail = error instanceof Error ? error.message : "The ticket could not be archived.";
    await warn(interaction, "Ticket not archived", [
      "The score is saved on Challonge, but this ticket stayed open.",
      detail,
      "Close it and generate the transcript manually.",
    ]);
    return;
  }
  await interaction.followUp(channelClosedMessage(interaction.user.id, actorTag)).catch(() => undefined);

  try {
    const archivedName = ticket.name.startsWith("✅") ? ticket.name : nextName;
    const transcriptUrl = await publishTicketTranscript(guild, ticket, tournament.transcriptChannelId, {
      tournamentName: tournament.name,
      actor: interaction.user,
      filename: transcriptFilename(archivedName),
      channelName: archivedName,
    });
    await attachResultsTranscript(guild, tournament.id, input.matchId, transcriptUrl).catch(() => undefined);
    await interaction.followUp(transcriptGeneratedMessage(transcriptUrl, actorTag)).catch(() => undefined);
  } catch (error) {
    console.error(`Battle ticket transcript failed for match ${input.matchId}`, error);
    await warn(interaction, "Transcript not generated", [
      "The score is saved and the ticket is archived, but the transcript could not be published.",
      "Generate it manually from this channel.",
    ]);
  }
}

async function warn(interaction: ChatInputCommandInteraction, title: string, lines: string[]): Promise<void> {
  const panel = bracketPanel("warn", title, lines);
  await interaction
    .followUp({ embeds: panel.embeds, allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral })
    .catch(() => undefined);
}
