import {
  ChannelType,
  ComponentType,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type TextChannel,
} from "discord.js";
import {
  ChallongeError,
  descendantMatchIds,
  fetchChallongeBracket,
  parseScoresCsv,
  reopenChallongeMatch,
  scoresCsv,
  updateChallongeMatch,
  winnerIdFromScores,
  type ChallongeBracket,
  type ChallongeMatch,
} from "../../lib/challonge.js";
import { decryptSecret } from "../../lib/crypto.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { prisma } from "../../lib/prisma.js";
import { v2Flags } from "../../lib/v2.js";
import { settingsCommandIdFor } from "../../lib/register-slash.js";
import { openPendingTickets } from "../room/open.js";
import { loadGuildSettings } from "../settings/store.js";
import { findTournamentById } from "../tournament/store.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { canCorrectBracket } from "./access.js";
import { auditScoreUpload } from "./audit.js";
import { deferBracket, respondBracket } from "./respond.js";
import {
  bracketNotice,
  bracketPanel,
  correctConfirmMessage,
  correctionCancelledMessage,
  parseCorrectConfirmCustomId,
  scoreCorrectedMessage,
  type CorrectTicket,
} from "./view.js";

type ComponentNode = {
  type: number;
  components?: ComponentNode[];
  disabled?: boolean;
};

function lockNode(node: ComponentNode): ComponentNode {
  if (node.type === ComponentType.Button) {
    return { ...node, disabled: true };
  }
  if (!node.components) {
    return node;
  }
  return { ...node, components: node.components.map(lockNode) };
}

async function lockConfirmButtons(interaction: ButtonInteraction): Promise<void> {
  const components = interaction.message.components.map((component) => lockNode(component.toJSON() as ComponentNode));
  await interaction.update({
    components,
    flags: v2Flags,
    allowedMentions: { parse: [] },
  });
}

function asSurface(payload: InteractionReplyOptions): InteractionUpdateOptions & InteractionEditReplyOptions {
  const flags = payload.flags;
  const v2 =
    (typeof flags === "number" && (flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2) ||
    (Array.isArray(flags) && flags.includes(MessageFlags.IsComponentsV2));
  return {
    content: v2 ? null : (payload.content ?? null),
    embeds: v2 ? [] : (payload.embeds ?? []),
    components: payload.components ?? [],
    allowedMentions: payload.allowedMentions ?? { parse: [] },
    ...(v2 ? { flags: v2Flags } : {}),
  };
}

type SideNames = { leftName: string; rightName: string; winnerName: string };

function namesFor(
  bracket: ChallongeBracket,
  match: ChallongeMatch,
  score1: number,
  score2: number,
): SideNames | null {
  if (match.player1Id == null || match.player2Id == null) {
    return null;
  }
  const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));
  const winnerId = winnerIdFromScores(match.player1Id, match.player2Id, score1, score2);
  return {
    leftName: names.get(match.player1Id) ?? "Unknown",
    rightName: names.get(match.player2Id) ?? "Unknown",
    winnerName: names.get(winnerId) ?? "Unknown",
  };
}

async function listDownstreamTickets(
  tournamentId: string,
  bracket: ChallongeBracket,
  matchIds: number[],
): Promise<CorrectTicket[]> {
  if (matchIds.length === 0) {
    return [];
  }
  const rooms = await prisma.room.findMany({
    where: { tournamentId, challongeMatchId: { in: matchIds } },
    select: { channelId: true, challongeMatchId: true, status: true },
  });
  if (rooms.length === 0) {
    return [];
  }
  const stored = await prisma.match.findMany({
    where: { tournamentId, challongeMatchId: { in: rooms.map((room) => room.challongeMatchId) } },
    select: { challongeMatchId: true, round: true, group: true, player1Name: true, player2Name: true },
  });
  const rows = new Map(stored.map((row) => [row.challongeMatchId, row]));
  const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));
  const live = new Map(bracket.matches.map((match) => [match.id, match]));

  return rooms
    .map((room) => {
      const row = rows.get(room.challongeMatchId);
      const match = live.get(room.challongeMatchId);
      return {
        channelId: room.channelId,
        round: row?.round ?? match?.round ?? null,
        group: row?.group ?? null,
        leftName: row?.player1Name || (match?.player1Id != null ? names.get(match.player1Id) : "") || "Unknown",
        rightName: row?.player2Name || (match?.player2Id != null ? names.get(match.player2Id) : "") || "Unknown",
        status: room.status,
      };
    })
    .sort((left, right) => (left.round ?? 999) - (right.round ?? 999) || left.leftName.localeCompare(right.leftName));
}

async function syncCompletedMatch(
  guildId: string,
  tournamentId: string,
  match: ChallongeMatch,
  leftName: string,
  rightName: string,
  group: string | null,
): Promise<void> {
  await prisma.match.upsert({
    where: { tournamentId_challongeMatchId: { tournamentId, challongeMatchId: match.id } },
    create: {
      guildId,
      tournamentId,
      challongeMatchId: match.id,
      state: "complete",
      round: match.round,
      group,
      thirdPlace: match.thirdPlace,
      player1Name: leftName,
      player2Name: rightName,
    },
    update: {
      state: "complete",
      round: match.round,
      group,
      thirdPlace: match.thirdPlace,
      player1Name: leftName,
      player2Name: rightName,
    },
  });
}

async function refreshBracketRows(guildId: string, tournament: TournamentRecord, apiKey: string): Promise<ChallongeBracket> {
  const bracket = await fetchChallongeBracket(tournament.challongeId, apiKey);
  const groupIds = [...new Set(bracket.matches.flatMap((match) => (match.groupId == null ? [] : [match.groupId])))].sort(
    (left, right) => left - right,
  );
  const letters = new Map(
    groupIds.map((id, index) => [id, index < 26 ? String.fromCharCode(65 + index) : `G${index + 1}`]),
  );
  const names = new Map(bracket.participants.map((participant) => [participant.id, participant.name]));

  await Promise.all(
    bracket.matches.map((match) => {
      const group = match.groupId == null ? null : (letters.get(match.groupId) ?? null);
      return prisma.match.upsert({
        where: {
          tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: match.id },
        },
        create: {
          guildId,
          tournamentId: tournament.id,
          challongeMatchId: match.id,
          state: match.state,
          round: match.round,
          group,
          thirdPlace: match.thirdPlace,
          player1Name: names.get(match.player1Id ?? -1) ?? "",
          player2Name: names.get(match.player2Id ?? -1) ?? "",
        },
        update: {
          state: match.state,
          round: match.round,
          group,
          thirdPlace: match.thirdPlace,
          player1Name: names.get(match.player1Id ?? -1) ?? "",
          player2Name: names.get(match.player2Id ?? -1) ?? "",
        },
      });
    }),
  );

  return bracket;
}

async function deleteDownstreamRooms(guild: Guild, tournamentId: string, matchIds: number[]): Promise<number> {
  if (matchIds.length === 0) {
    return 0;
  }
  const rooms = await prisma.room.findMany({
    where: { tournamentId, challongeMatchId: { in: matchIds } },
  });
  let deleted = 0;
  for (const room of rooms) {
    const channel = await guild.channels.fetch(room.channelId).catch(() => null);
    if (channel && channel.type === ChannelType.GuildText) {
      await (channel as TextChannel).delete("Bracket correction invalidated this ticket").catch(() => undefined);
    }
    await prisma.room.delete({ where: { id: room.id } }).catch(() => undefined);
    await prisma.schedule.deleteMany({ where: { tournamentId, challongeMatchId: room.challongeMatchId } });
    deleted += 1;
  }
  return deleted;
}

function reopenOrder(rootId: number, bracket: ChallongeBracket, targetIds: number[]): number[] {
  const depth = new Map<number, number>();
  const byId = new Map(bracket.matches.map((match) => [match.id, match]));

  function depthOf(id: number): number {
    const cached = depth.get(id);
    if (cached != null) {
      return cached;
    }
    if (id === rootId) {
      depth.set(id, 0);
      return 0;
    }
    const match = byId.get(id);
    const parents = [match?.player1PrereqMatchId, match?.player2PrereqMatchId].filter(
      (value): value is number => value != null,
    );
    const value = parents.length === 0 ? 1 : Math.max(...parents.map(depthOf)) + 1;
    depth.set(id, value);
    return value;
  }

  return [...targetIds].sort((left, right) => depthOf(right) - depthOf(left));
}

async function applyCorrection(
  guild: Guild,
  tournament: TournamentRecord,
  apiKey: string,
  matchId: number,
  score1: number,
  score2: number,
  rebuild: boolean,
): Promise<{
  leftName: string;
  rightName: string;
  winnerName: string;
  oldScore1: number | null;
  oldScore2: number | null;
  rebuilt: number;
}> {
  const bracket = await fetchChallongeBracket(tournament.challongeId, apiKey);
  const match = bracket.matches.find((item) => item.id === matchId);
  if (!match || match.player1Id == null || match.player2Id == null) {
    throw new Error("That match is missing both sides on Challonge.");
  }
  if (match.state.toLowerCase() !== "complete") {
    throw new Error("Only completed matches can be corrected. Upload a score first.");
  }

  const sides = namesFor(bracket, match, score1, score2);
  if (!sides) {
    throw new Error("That match is missing both sides on Challonge.");
  }

  const old = parseScoresCsv(match.scoresCsv);
  const oldWinner = match.winnerId;
  const newWinner = winnerIdFromScores(match.player1Id, match.player2Id, score1, score2);
  const winnerChanged = oldWinner != null && oldWinner !== newWinner;

  let rebuilt = 0;
  if (rebuild && winnerChanged) {
    const downstream = descendantMatchIds(match.id, bracket.matches);
    const completedDownstream = downstream.filter((id) => {
      const child = bracket.matches.find((item) => item.id === id);
      return child?.state.toLowerCase() === "complete";
    });
    for (const id of reopenOrder(match.id, bracket, completedDownstream)) {
      await reopenChallongeMatch(tournament.challongeId, id, apiKey);
    }
    rebuilt = await deleteDownstreamRooms(guild, tournament.id, downstream);
  }

  await updateChallongeMatch(tournament.challongeId, match.id, apiKey, scoresCsv(score1, score2), newWinner);

  const stored = await prisma.match.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: match.id } },
    select: { group: true },
  });
  await syncCompletedMatch(guild.id, tournament.id, match, sides.leftName, sides.rightName, stored?.group ?? null);
  await refreshBracketRows(guild.id, tournament, apiKey);

  if (rebuild && winnerChanged && rebuilt > 0) {
    const downstream = descendantMatchIds(match.id, bracket.matches);
    await openPendingTickets(guild, tournament, { group: null, round: null, matchIds: downstream });
  }

  return {
    leftName: sides.leftName,
    rightName: sides.rightName,
    winnerName: sides.winnerName,
    oldScore1: old?.score1 ?? null,
    oldScore2: old?.score2 ?? null,
    rebuilt,
  };
}

export async function runBracketCorrect(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild || !interaction.guildId) {
    await respondBracket(interaction, bracketPanel("error", "Server only", ["Run this inside a server."]));
    return;
  }

  if (!(await canCorrectBracket(interaction))) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Organiser required", [
        "Only an **Organiser** (manager role) or a Discord **Administrator** can correct the bracket.",
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

  const tournamentId = interaction.options.getString("tournament", true);
  const matchRaw = interaction.options.getString("match", true);
  const score1 = interaction.options.getInteger("score1", true);
  const score2 = interaction.options.getInteger("score2", true);
  const matchId = Number(matchRaw);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    await respondBracket(interaction, bracketPanel("error", "Invalid match", ["Pick a match from the autocomplete list."]));
    return;
  }
  if (score1 === score2) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Tie not allowed", ["Bracket scores cannot be a tie. One side must win."]),
    );
    return;
  }

  const tournament = await findTournamentById(guild.id, tournamentId);
  if (!tournament) {
    await respondBracket(
      interaction,
      bracketPanel("error", "Tournament missing", ["That tournament is no longer registered in this server."]),
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
    const match = bracket.matches.find((item) => item.id === matchId);
    if (!match || match.player1Id == null || match.player2Id == null) {
      await respondBracket(
        interaction,
        bracketPanel("error", "Match missing", ["That match is not available on Challonge with both sides set."]),
      );
      return;
    }
    if (match.state.toLowerCase() !== "complete") {
      await respondBracket(
        interaction,
        bracketPanel("error", "Match not complete", ["Only completed matches can be corrected."]),
      );
      return;
    }

    const sides = namesFor(bracket, match, score1, score2);
    if (!sides) {
      await respondBracket(
        interaction,
        bracketPanel("error", "Match missing", ["That match is not available on Challonge with both sides set."]),
      );
      return;
    }

    const newWinner = winnerIdFromScores(match.player1Id, match.player2Id, score1, score2);
    const winnerChanged = match.winnerId != null && match.winnerId !== newWinner;
    const downstream = descendantMatchIds(match.id, bracket.matches);
    const tickets = winnerChanged ? await listDownstreamTickets(tournament.id, bracket, downstream) : [];
    const previous = parseScoresCsv(match.scoresCsv);

    if (tickets.length > 0) {
      await respondBracket(
        interaction,
        correctConfirmMessage({
          tournamentName: tournament.name,
          leftName: sides.leftName,
          rightName: sides.rightName,
          oldScore1: previous?.score1 ?? null,
          oldScore2: previous?.score2 ?? null,
          score1,
          score2,
          winnerName: sides.winnerName,
          tickets,
          actorTag: interaction.user.username,
          userId: interaction.user.id,
          tournamentId: tournament.id,
          matchId,
        }),
      );
      return;
    }

    const result = await applyCorrection(guild, tournament, apiKey, matchId, score1, score2, false);
    await respondBracket(
      interaction,
      scoreCorrectedMessage({
        tournamentName: tournament.name,
        leftName: result.leftName,
        rightName: result.rightName,
        oldScore1: result.oldScore1,
        oldScore2: result.oldScore2,
        score1,
        score2,
        winnerName: result.winnerName,
        rebuilt: 0,
        actorTag: interaction.user.username,
      }),
    );
    await auditScoreUpload(interaction, guild, settings, {
      action: "corrected",
      tournamentName: tournament.name,
      matchId,
      leftName: result.leftName,
      rightName: result.rightName,
      score1,
      score2,
      winnerName: result.winnerName,
      oldScore1: result.oldScore1,
      oldScore2: result.oldScore2,
    });
  } catch (error) {
    const message =
      error instanceof ChallongeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The bracket could not be corrected.";
    await respondBracket(interaction, bracketPanel("error", "Correction failed", [message]));
  }
}

export async function handleBracketButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCorrectConfirmCustomId(interaction.customId);
  if (!parsed) {
    return;
  }

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply(
      bracketPanel("error", "Not your confirmation", ["Only the person who ran `/bracket correct` can use these buttons."]),
    );
    return;
  }

  const guild = interaction.guild;
  if (!guild || !interaction.guildId) {
    await interaction.reply(bracketPanel("error", "Server only", ["Run this inside a server."]));
    return;
  }

  await lockConfirmButtons(interaction);

  if (!(await canCorrectBracket(interaction))) {
    await interaction.editReply(
      asSurface(
        bracketNotice("error", "Organiser required", [
          "Only an **Organiser** (manager role) or a Discord **Administrator** can correct the bracket.",
        ]),
      ),
    );
    return;
  }

  if (parsed.action === "no") {
    await interaction.editReply(asSurface(correctionCancelledMessage()));
    return;
  }

  const settings = await loadGuildSettings(guild.id);
  const tournament = await findTournamentById(guild.id, parsed.tournamentId);
  if (!settings || !tournament) {
    await interaction.editReply(
      asSurface(
        bracketNotice("error", "Setup missing", [
          "Settings or tournament are no longer available. Nothing was changed.",
        ]),
      ),
    );
    return;
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(tournament.challongeKeyEnc);
  } catch {
    await interaction.editReply(
      asSurface(bracketNotice("error", "Bracket key unreadable", ["The stored Challonge key could not be decrypted."])),
    );
    return;
  }

  try {
    const result = await applyCorrection(
      guild,
      tournament,
      apiKey,
      parsed.matchId,
      parsed.score1,
      parsed.score2,
      true,
    );
    await interaction.editReply(
      asSurface(
        scoreCorrectedMessage({
          tournamentName: tournament.name,
          leftName: result.leftName,
          rightName: result.rightName,
          oldScore1: result.oldScore1,
          oldScore2: result.oldScore2,
          score1: parsed.score1,
          score2: parsed.score2,
          winnerName: result.winnerName,
          rebuilt: result.rebuilt,
          actorTag: interaction.user.username,
        }),
      ),
    );
    await auditScoreUpload(interaction, guild, settings, {
      action: "corrected",
      tournamentName: tournament.name,
      matchId: parsed.matchId,
      leftName: result.leftName,
      rightName: result.rightName,
      score1: parsed.score1,
      score2: parsed.score2,
      winnerName: result.winnerName,
      oldScore1: result.oldScore1,
      oldScore2: result.oldScore2,
      rebuilt: result.rebuilt,
    });
  } catch (error) {
    const message =
      error instanceof ChallongeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "The bracket could not be corrected.";
    await interaction.editReply(asSurface(bracketNotice("error", "Correction failed", [message])));
  }
}
