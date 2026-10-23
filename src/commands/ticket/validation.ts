import type { GuildSettings } from "@prisma/client";
import type { ChatInputCommandInteraction, Guild, TextChannel } from "discord.js";
import { formatChannel } from "../../lib/formatters.js";
import { findTournamentByChallongeId } from "../tournament/store.js";
import { escapeDiscord } from "../room/labels.js";
import { respondRoom } from "../room/respond.js";
import { roomPanel } from "../room/view.js";
import { auditValidationClose } from "./audit.js";
import { publishTicketTranscript } from "./transcript/index.js";

const DELETE_DELAY_MS = 5000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function closeValidationTicket(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel,
  guild: Guild,
  settings: GuildSettings,
  parsed: { challongeId: string; transcriptChannelId: string },
): Promise<void> {
  const tournament = await findTournamentByChallongeId(guild.id, parsed.challongeId);
  const tournamentName = tournament?.name ?? parsed.challongeId;
  const channelId = channel.id;
  const deleteAt = Date.now() + DELETE_DELAY_MS;

  await respondRoom(
    interaction,
    roomPanel("info", "Ticket closing", [
      "This validation ticket will be deleted in **5** seconds.",
      "Switch to another channel now if you still need to leave this one.",
      `The transcript will be saved to ${formatChannel(guild, parsed.transcriptChannelId)}.`,
    ]),
  );

  try {
    await publishTicketTranscript(guild, channel, parsed.transcriptChannelId, {
      tournamentName,
      actor: interaction.user,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The transcript could not be sent.";
    await respondRoom(interaction, roomPanel("error", "Transcript failed", [detail, "This validation ticket is still here."]));
    return;
  }

  const remaining = deleteAt - Date.now();
  if (remaining > 0) {
    await wait(remaining);
  }

  await respondRoom(
    interaction,
    roomPanel("success", "Validation ticket archived", [
      `**${escapeDiscord(tournamentName)}** was saved to ${formatChannel(guild, parsed.transcriptChannelId)}.`,
      "This channel will be removed now.",
    ]),
  );

  try {
    await channel.delete("Group validation ticket archived");
  } catch {
    await respondRoom(
      interaction,
      roomPanel("error", "Channel still open", [
        `The transcript is in ${formatChannel(guild, parsed.transcriptChannelId)}.`,
        "Discord did not remove this validation ticket.",
      ]),
    );
    return;
  }

  await auditValidationClose(interaction, guild, settings, tournamentName, channelId, parsed.transcriptChannelId);
}
