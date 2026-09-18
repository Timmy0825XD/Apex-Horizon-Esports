import type { ChatInputCommandInteraction } from "discord.js";
import { encryptSecret, hasEncryptionKey } from "../../lib/crypto.js";
import { ChallongeError, fetchChallongeTournament, normalizeChallongeId } from "./challonge.js";
import { isAdminContext, requireAdmin } from "./access.js";
import { auditTournamentAdd } from "./audit.js";
import { readCreateWorld, duplicateIds } from "./options.js";
import { deferTournament, respondTournament } from "./respond.js";
import { findBannedPlayers } from "./banned-ids.js";
import { SheetError, loadParsedSheet } from "./sheet.js";
import {
  MAX_ACTIVE_TOURNAMENTS,
  countTournaments,
  createTournament,
  findTournamentByChallongeId,
  findTournamentByName,
  saveTournamentSheet,
} from "./store.js";
import { tournamentBannedPlayersMessage, tournamentErrorMessage, tournamentWorldMessage } from "./view.js";

export async function handleTournamentAdd(interaction: ChatInputCommandInteraction, commandId?: string): Promise<void> {
  await deferTournament(interaction);

  const access = await requireAdmin(interaction, "register a tournament");
  if (!isAdminContext(access)) {
    await respondTournament(interaction, access.error);
    return;
  }

  if (!hasEncryptionKey()) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Missing encryption key",
        "Set `ENCRYPTION_KEY` (64 hex characters) in the bot environment before storing Challonge keys.",
        false,
      ),
    );
    return;
  }

  const { guild, settings } = access;
  const active = await countTournaments(guild.id);
  if (active >= MAX_ACTIVE_TOURNAMENTS) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Tournament limit reached",
        `This server already has **${MAX_ACTIVE_TOURNAMENTS}** active tournaments. Delete one before registering another.`,
        false,
      ),
    );
    return;
  }

  const name = interaction.options.getString("name", true).trim();
  const challongeId = normalizeChallongeId(interaction.options.getString("id", true));
  const key = interaction.options.getString("key", true).trim();
  const sheetLink = interaction.options.getString("sheet_link", true).trim();

  if (!name || !challongeId || !key || !sheetLink) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Missing fields", "Name, Challonge ID, API key, and sheet link are required.", false),
    );
    return;
  }

  if (await findTournamentByName(guild.id, name)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Name in use", `**${name}** is already registered in this server.`, false),
    );
    return;
  }

  if (await findTournamentByChallongeId(guild.id, challongeId)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Bracket already linked",
        `Challonge \`${challongeId}\` is already registered as a tournament in this server.`,
        false,
      ),
    );
    return;
  }

  const worldDraft = readCreateWorld(interaction, {
    name,
    challongeId,
    sheetLink,
    format: "1vs1",
    additionalFieldCount: 0,
  });

  const ids = [
    worldDraft.attendanceChannelId,
    worldDraft.transcriptChannelId,
    worldDraft.rulesChannelId,
    worldDraft.deadlineChannelId,
    worldDraft.resultChannelId,
    worldDraft.eventsLinksChannelId,
    worldDraft.closedTicketCategoryId,
    worldDraft.closeTicketCategory2Id,
    ...worldDraft.ticketOpenCategoryIds,
  ];
  if (duplicateIds(ids)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Duplicate channels",
        "Each ticket category and each channel field must be unique. Pick different categories for open and closed tickets.",
        false,
      ),
    );
    return;
  }

  let parsed;
  try {
    parsed = await loadParsedSheet(sheetLink);
    await fetchChallongeTournament(challongeId, key);
  } catch (error) {
    if (error instanceof SheetError || error instanceof ChallongeError) {
      await respondTournament(interaction, tournamentErrorMessage("Could not register tournament", error.message, false));
      return;
    }
    throw error;
  }

  let banned;
  try {
    banned = await findBannedPlayers(parsed);
  } catch (error) {
    if (error instanceof SheetError) {
      await respondTournament(interaction, tournamentErrorMessage("Could not check banned IDs", error.message, false));
      return;
    }
    throw error;
  }
  if (banned.length > 0) {
    await respondTournament(interaction, tournamentBannedPlayersMessage(banned, "add"));
    return;
  }

  const world = {
    ...worldDraft,
    format: parsed.format,
    additionalFieldCount: parsed.additionalFieldCount,
    autoRoomRunning: false as const,
  };
  const saved = await createTournament(guild.id, world, encryptSecret(key), interaction.user.id);
  await saveTournamentSheet(guild.id, guild.name, saved, parsed);

  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondTournament(
    interaction,
    tournamentWorldMessage(
      "add",
      guild,
      saved,
      commandId,
      interaction.client.user?.displayAvatarURL({ size: 256 }),
    ),
  );
  await auditTournamentAdd(interaction, guild, settings, saved);
}
