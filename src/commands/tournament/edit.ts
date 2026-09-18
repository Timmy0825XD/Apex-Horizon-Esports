import type { ChatInputCommandInteraction } from "discord.js";
import { encryptSecret, hasEncryptionKey } from "../../lib/crypto.js";
import { ChallongeError, fetchChallongeTournament } from "./challonge.js";
import { isAdminContext, requireAdmin } from "./access.js";
import { auditTournamentEdit } from "./audit.js";
import { changedWorldKeys, duplicateIds, mergeWorld, readWorldPatch } from "./options.js";
import { deferTournament, respondTournament } from "./respond.js";
import { findBannedPlayers } from "./banned-ids.js";
import { SheetError, loadParsedSheet } from "./sheet.js";
import {
  findTournamentById,
  findTournamentByName,
  renameTournamentSheets,
  saveTournamentSheet,
  updateTournament,
} from "./store.js";
import { tournamentBannedPlayersMessage, tournamentErrorMessage, tournamentWorldMessage } from "./view.js";

export async function handleTournamentEdit(interaction: ChatInputCommandInteraction, commandId?: string): Promise<void> {
  await deferTournament(interaction);

  const access = await requireAdmin(interaction, "edit a tournament");
  if (!isAdminContext(access)) {
    await respondTournament(interaction, access.error);
    return;
  }

  const { guild, settings } = access;
  const current = await findTournamentById(guild.id, interaction.options.getString("id", true));
  if (!current) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("Unknown tournament", "Pick a tournament from the autocomplete list.", false),
    );
    return;
  }

  const patch = readWorldPatch(interaction);
  if (Object.keys(patch).length === 0) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Nothing to update",
        "Pass at least one field. Leave the rest empty to keep the current value.",
        false,
      ),
    );
    return;
  }

  if (patch.key && !hasEncryptionKey()) {
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

  if (patch.name && patch.name !== current.name) {
    const clash = await findTournamentByName(guild.id, patch.name);
    if (clash && clash.id !== current.id) {
      await respondTournament(
        interaction,
        tournamentErrorMessage("Name in use", `**${patch.name}** is already registered in this server.`, false),
      );
      return;
    }
  }

  let next = mergeWorld(current, patch);

  const ids = [
    next.attendanceChannelId,
    next.transcriptChannelId,
    next.rulesChannelId,
    next.deadlineChannelId,
    next.resultChannelId,
    next.eventsLinksChannelId,
    next.closedTicketCategoryId,
    next.closeTicketCategory2Id,
    ...next.ticketOpenCategoryIds,
  ];
  if (duplicateIds(ids)) {
    await respondTournament(
      interaction,
      tournamentErrorMessage(
        "Duplicate channels",
        "Each ticket category and each channel field must be unique.",
        false,
      ),
    );
    return;
  }

  let parsed = null;
  try {
    if (patch.sheetLink) {
      parsed = await loadParsedSheet(patch.sheetLink);
      next = {
        ...next,
        format: parsed.format,
        additionalFieldCount: parsed.additionalFieldCount,
        sheetLink: patch.sheetLink,
      };
    }
    if (patch.key) {
      await fetchChallongeTournament(current.challongeId, patch.key);
    }
  } catch (error) {
    if (error instanceof SheetError || error instanceof ChallongeError) {
      await respondTournament(interaction, tournamentErrorMessage("Could not update tournament", error.message, false));
      return;
    }
    throw error;
  }

  if (parsed) {
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
      await respondTournament(interaction, tournamentBannedPlayersMessage(banned, "edit"));
      return;
    }
  }

  const changed = changedWorldKeys(current, next);
  const keyChanged = Boolean(patch.key);
  if (changed.length === 0 && !keyChanged) {
    await respondTournament(
      interaction,
      tournamentErrorMessage("No changes", "Every value you sent already matches this tournament.", false),
    );
    return;
  }

  const saved = await updateTournament(
    current.id,
    next,
    keyChanged && patch.key ? encryptSecret(patch.key) : current.challongeKeyEnc,
  );

  if (parsed) {
    await saveTournamentSheet(guild.id, guild.name, saved, parsed);
  } else if (patch.name && patch.name !== current.name) {
    await renameTournamentSheets(guild.id, saved.id, saved.name);
  }

  await guild.roles.fetch().catch(() => undefined);
  await guild.channels.fetch().catch(() => undefined);
  await respondTournament(
    interaction,
    tournamentWorldMessage(
      "edit",
      guild,
      saved,
      commandId,
      interaction.client.user?.displayAvatarURL({ size: 256 }),
    ),
  );
  await auditTournamentEdit(interaction, guild, settings, saved, changed, keyChanged);
}
