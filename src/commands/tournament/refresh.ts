import { ContainerBuilder, type ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { embedColors } from "../../lib/embeds.js";
import { formatSheetLink } from "../../lib/formatters.js";
import { textBlock, v2Flags } from "../../lib/v2.js";
import { escapeDiscord } from "../room/labels.js";
import { isAdminContext, requireAdmin } from "./access.js";
import { auditTournamentRefresh } from "./audit.js";
import { findBannedPlayers } from "./banned-ids.js";
import { deferTournament, respondTournament } from "./respond.js";
import { SheetError, loadParsedSheet } from "./sheet.js";
import { findTournamentById, saveTournamentSheet, updateTournament } from "./store.js";
import { tournamentBannedPlayersMessage, tournamentErrorMessage } from "./view.js";

/** Re-reads the tournament's Google Sheet and replaces the stored copy that tickets and schedules use. */
export async function handleTournamentRefresh(interaction: ChatInputCommandInteraction): Promise<void> {
  await deferTournament(interaction);

  const access = await requireAdmin(interaction, "refresh a tournament sheet");
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

  let parsed;
  let banned;
  try {
    parsed = await loadParsedSheet(current.sheetLink);
    banned = await findBannedPlayers(parsed);
  } catch (error) {
    if (error instanceof SheetError) {
      await respondTournament(interaction, tournamentErrorMessage("Could not read the sheet", error.message, false));
      return;
    }
    throw error;
  }
  if (banned.length > 0) {
    await respondTournament(interaction, tournamentBannedPlayersMessage(banned, "edit"));
    return;
  }

  let saved = current;
  if (parsed.format !== current.format || parsed.additionalFieldCount !== current.additionalFieldCount) {
    saved = await updateTournament(
      current.id,
      { ...current, format: parsed.format, additionalFieldCount: parsed.additionalFieldCount },
      current.challongeKeyEnc,
    );
  }
  await saveTournamentSheet(guild.id, guild.name, saved, parsed);

  await respondTournament(interaction, {
    flags: v2Flags,
    allowedMentions: { parse: [] },
    components: [
      new ContainerBuilder()
        .setAccentColor(embedColors.success)
        .addTextDisplayComponents(
          textBlock(`## ${emojis.success} Sheet Refreshed`),
          textBlock(
            [
              `The stored copy of **${escapeDiscord(saved.name)}** now matches ${formatSheetLink(saved.sheetLink)}.`,
              `**${parsed.teams.length}** ${parsed.teams.length === 1 ? "entry" : "entries"} · \`${parsed.format}\``,
              "*New tickets and schedules use it. Open tickets keep the members they already have.*",
            ].join("\n"),
          ),
        ),
    ],
  });

  await auditTournamentRefresh(interaction, guild, settings, saved, parsed.teams.length);
}
