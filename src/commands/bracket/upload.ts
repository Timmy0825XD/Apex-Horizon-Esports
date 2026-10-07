import { ChannelType, MessageFlags, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import {
  ChallongeError,
  fetchChallongeBracket,
  scoresCsv,
  updateChallongeMatch,
  winnerIdFromScores,
} from "../../lib/challonge.js";
import { decryptSecret } from "../../lib/crypto.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { attachResultsTranscript } from "../schedule/results.js";
import { loadGuildSettings } from "../settings/store.js";
import { loadStaffConfig } from "../../lib/organiser.js";
import { closeTicket } from "../ticket/lifecycle.js";
import { findTournamentById } from "../tournament/store.js";
import { canUploadScore } from "./access.js";
import { auditScoreUpload } from "./audit.js";
import { deferBracket, respondBracket } from "./respond.js";
import { publishTicketTranscript, transcriptFilename } from "./transcript.js";
import {
  bracketPanel,
  channelClosedMessage,
  matchUpdatedMessage,
  transcriptGeneratedMessage,
} from "./view.js";

async function syncMatchRow(
  guildId: string,
  tournamentId: string,
  matchId: number,
  state: string,
  leftName: string,
  rightName: string,
  round: number,
  group: string | null,
): Promise<void> {
  await prisma.match.upsert({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId: matchId } },
    create: {
      guildId,
      tournamentId,
      challongeMatchId: matchId,
      state,
      round,
      group,
      player1Name: leftName,
      player2Name: rightName,
    },
    update: { state, round, group, player1Name: leftName, player2Name: rightName },
  });
}

function archivedChannelName(current: string): string {
  const bare = current.replace(/^[✅🔴]+/u, "").replace(/^-+/, "");
  const next = `✅${bare}`.slice(0, 100).replace(/-+$/g, "");
  return next || "done";
}

export async function runBracketUpload(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !interaction.guildId || !channel || channel.type !== ChannelType.GuildText) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Not a battle ticket", ["Run `/bracket upload` inside a battle-ticket text channel."]),
    );
    return;
  }

  const score1 = interaction.options.getInteger("score1", true);
  const score2 = interaction.options.getInteger("score2", true);
  const note = interaction.options.getString("note")?.trim() || null;

  if (score1 === score2) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Tie not allowed", ["Bracket scores cannot be a tie. One side must win."]),
    );
    return;
  }

  const room = await prisma.room.findUnique({ where: { channelId: channel.id } });
  if (!room || room.guildId !== guild.id) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Not a battle ticket", ["This channel is not linked to a bracket match."]),
    );
    return;
  }

  if (room.status === "closed") {
    await respondBracket(
      interaction,
      bracketPanel("error", "Ticket already closed", ["This battle ticket is already archived. Use `/bracket correct` to amend the score."]),
    );
    return;
  }

  const tournament = await findTournamentById(guild.id, room.tournamentId);
  if (!tournament) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Tournament missing", ["The tournament for this ticket is no longer registered."]),
    );
    return;
  }

  const staff = await loadStaffConfig(guild.id);
  if (!(await canUploadScore(interaction, tournament, staff))) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Staff required", [
        "Only tournament staff (admin/helper, judge, recorder, or staff role) or an **Organiser** can upload a score.",
      ]),
    );
    return;
  }

  const settings = await loadGuildSettings(guild.id);
  if (!settings) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Settings not configured", [
        `Run ${formatHelpEntry("settings set", settingsCommandIdFor(guild.id))} first.`,
      ]),
    );
    return;
  }

  await deferBracket(interaction, false);

  let apiKey: string;
  try {
    apiKey = decryptSecret(tournament.challongeKeyEnc);
  } catch {
    await respondBracket(
      interaction,
      bracketPanel("error", "Bracket key unreadable", ["The stored Challonge key could not be decrypted."]),
    );
    return;
  }

  try {
    const bracket = await fetchChallongeBracket(tournament.challongeId, apiKey);
    const match = bracket.matches.find((item) => item.id === room.challongeMatchId);
    if (!match) {
      await respondBracket(
        interaction,
        bracketPanel("error", "Match missing", [`Challonge has no match \`${room.challongeMatchId}\` on this tournament.`]),
      );
      return;
    }
    if (match.player1Id == null || match.player2Id == null) {
      await respondBracket(
        interaction,
        bracketPanel("error", "Match not ready", ["Both sides must be set on Challonge before uploading a score."]),
      );
      return;
    }
    if (match.state.toLowerCase() === "complete") {
      await respondBracket(
        interaction,
        bracketPanel("error", "Score already posted", [
          "This match is already complete on Challonge. Use `/bracket correct` to amend it.",
        ]),
      );
      return;
    }

    const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));
    const leftName = names.get(match.player1Id) ?? "Unknown";
    const rightName = names.get(match.player2Id) ?? "Unknown";
    const winnerId = winnerIdFromScores(match.player1Id, match.player2Id, score1, score2);
    const winnerName = names.get(winnerId) ?? "Unknown";
    const csv = scoresCsv(score1, score2);

    await updateChallongeMatch(tournament.challongeId, match.id, apiKey, csv, winnerId);
    const existing = await prisma.match.findUnique({
      where: {
        tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: match.id },
      },
      select: { group: true },
    });
    await syncMatchRow(
      guild.id,
      tournament.id,
      match.id,
      "complete",
      leftName,
      rightName,
      match.round,
      existing?.group ?? null,
    );

    const actorTag = interaction.user.username;
    await respondBracket(
      interaction,
      matchUpdatedMessage({
        tournamentName: tournament.name,
        leftName,
        rightName,
        score1,
        score2,
        winnerName,
        channelId: channel.id,
        actorTag,
        avatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
        note,
      }),
    );

    const ticket = channel as TextChannel;
    const nextName = archivedChannelName(ticket.name);
    if (nextName !== ticket.name) {
      await ticket.setName(nextName, "Bracket score uploaded").catch(() => undefined);
    }
    await closeTicket(ticket, guild, tournament);

    await interaction.followUp(channelClosedMessage(interaction.user.id, actorTag));

    const archivedName = ticket.name.startsWith("✅") ? ticket.name : nextName;
    const transcriptUrl = await publishTicketTranscript(guild, ticket, tournament.transcriptChannelId, {
      tournamentName: tournament.name,
      actor: interaction.user,
      filename: transcriptFilename(archivedName),
      channelName: archivedName,
    });
    await attachResultsTranscript(guild, tournament.id, match.id, transcriptUrl).catch(() => undefined);
    await interaction.followUp(transcriptGeneratedMessage(transcriptUrl, actorTag));

    await auditScoreUpload(interaction, guild, settings, {
      action: "uploaded",
      tournamentName: tournament.name,
      matchId: match.id,
      leftName,
      rightName,
      score1,
      score2,
      winnerName,
      channelId: channel.id,
      note,
    });
  } catch (error) {
    const message =
      error instanceof ChallongeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The score could not be uploaded.";
    const panel = bracketPanel("error", "Upload failed", [message]);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: panel.embeds,
        allowedMentions: { parse: [] },
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await respondBracket(interaction, panel);
  }
}
