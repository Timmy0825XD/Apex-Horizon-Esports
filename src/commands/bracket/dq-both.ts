import { ChannelType, MessageFlags, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { ChallongeError, fetchChallongeBracket, scoresCsv, updateChallongeMatch, winnerIdFromScores } from "../../lib/challonge.js";
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
import { markPendingForfeit, settlePendingForfeits } from "./forfeit.js";
import { deferBracket, respondBracket } from "./respond.js";
import { publishTicketTranscript, transcriptFilename } from "../ticket/transcript/index.js";
import { bothDisqualifiedMessage, bracketPanel, channelClosedMessage, transcriptGeneratedMessage } from "./view.js";

function archivedChannelName(current: string): string {
  const bare = current.replace(/^[✅🔴]+/u, "").replace(/^-+/, "");
  const next = `✅${bare}`.slice(0, 100).replace(/-+$/g, "");
  return next || "done";
}

export async function runBracketDqBoth(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !interaction.guildId || !channel || channel.type !== ChannelType.GuildText) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Not a battle ticket", ["Run `/bracket dq_both` inside a battle-ticket text channel."]),
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
      bracketPanel("error", "Ticket already closed", [
        "This battle ticket is already archived. Use `/bracket correct` to amend the score.",
      ]),
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
        "Only tournament staff (admin/helper, judge, recorder, or staff role) or an **Organiser** can disqualify both sides.",
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
        bracketPanel("error", "Match not ready", ["Both sides must be set on Challonge before disqualifying the match."]),
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
    const score1 = 0;
    const score2 = -1;
    const winnerId = winnerIdFromScores(match.player1Id, match.player2Id, score1, score2);
    const winnerName = names.get(winnerId) ?? "Unknown";

    await updateChallongeMatch(tournament.challongeId, match.id, apiKey, scoresCsv(score1, score2), winnerId);
    const existing = await prisma.match.findUnique({
      where: {
        tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: match.id },
      },
      select: { group: true },
    });
    await prisma.match.upsert({
      where: { tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: match.id } },
      create: {
        guildId: guild.id,
        tournamentId: tournament.id,
        challongeMatchId: match.id,
        state: "complete",
        round: match.round,
        group: existing?.group ?? null,
        player1Name: leftName,
        player2Name: rightName,
      },
      update: {
        state: "complete",
        round: match.round,
        group: existing?.group ?? null,
        player1Name: leftName,
        player2Name: rightName,
      },
    });
    await markPendingForfeit(guild.id, tournament.id, winnerId);

    let forfeited: Awaited<ReturnType<typeof settlePendingForfeits>> = [];
    let forfeitFailed = false;
    try {
      forfeited = await settlePendingForfeits({ guild, tournament, actor: interaction.user });
    } catch (error) {
      forfeitFailed = true;
      console.error("Pending forfeit settle failed after dq_both", error);
    }
    const pendingLeft = new Set(
      (
        await prisma.pendingForfeit.findMany({
          where: { tournamentId: tournament.id },
          select: { participantId: true },
        })
      ).map((row) => row.participantId),
    );

    const actorTag = interaction.user.username;
    await respondBracket(
      interaction,
      bothDisqualifiedMessage({
        tournamentName: tournament.name,
        leftName,
        rightName,
        winnerName,
        channelId: channel.id,
        actorTag,
        avatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
        forfeited,
        stillMarked: pendingLeft.has(winnerId) || forfeited.some((match) => pendingLeft.has(match.winnerId)),
        forfeitFailed,
      }),
    );

    const ticket = channel as TextChannel;
    const nextName = archivedChannelName(ticket.name);
    if (nextName !== ticket.name) {
      await ticket.setName(nextName, "Both sides disqualified").catch(() => undefined);
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
      action: "disqualified",
      tournamentName: tournament.name,
      matchId: match.id,
      leftName,
      rightName,
      score1,
      score2,
      winnerName,
      channelId: channel.id,
      note: "Side 1 advances and is forfeited in the next match. Side 2 is eliminated.",
    });
  } catch (error) {
    const message =
      error instanceof ChallongeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Both sides could not be disqualified.";
    const panel = bracketPanel("error", "Disqualification failed", [message]);
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
