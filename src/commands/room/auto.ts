import type { ChatInputCommandInteraction } from "discord.js";
import { emojis } from "../../emojis.js";
import { ChallongeError } from "../../lib/challonge.js";
import { auditAutoRoom } from "./audit.js";
import { nextSlotStart } from "./auto-slot.js";
import { TicketQueueError } from "./bracket.js";
import { openPendingTickets } from "./open.js";
import { prepareTournament } from "./prepare.js";
import { deferRoom, respondRoom } from "./respond.js";
import { creationReport } from "./report.js";
import { autoRoomMessage, roomPanel, type AutoRoomState } from "./view.js";
import { setAutoRoomRunning } from "../tournament/store.js";

/** `/room auto`: turns the auto-room worker on or off for one tournament. */
export async function handleRoomAutoSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const ready = await prepareTournament(interaction, "change auto-room");
  if (!ready) {
    return;
  }

  const status = interaction.options.getBoolean("status", true);
  const card = (state: AutoRoomState) =>
    autoRoomMessage({
      state,
      guildId: ready.guild.id,
      tournamentName: ready.tournament.name,
      nextRun: nextSlotStart(new Date()),
      actorId: interaction.user.id,
    });

  if (status === ready.tournament.autoRoomRunning) {
    await respondRoom(interaction, card(status ? "already-on" : "already-off"));
    return;
  }

  if (!status) {
    await setAutoRoomRunning(ready.tournament.id, false);
    await respondRoom(interaction, card("off"));
    await auditAutoRoom(interaction, ready.guild, ready.settings, ready.tournament.name, false, []);
    return;
  }

  await deferRoom(interaction, false);
  try {
    await setAutoRoomRunning(ready.tournament.id, true);
    const result = await openPendingTickets(ready.guild, ready.tournament, undefined, interaction.user);
    if (result.created.length === 0 && result.failed.length === 0) {
      await respondRoom(interaction, card("on"));
    } else {
      const nextRun = Math.floor(nextSlotStart(new Date()).getTime() / 1000);
      await respondRoom(
        interaction,
        creationReport(ready.guild, ready.tournament.name, result, {
          title: "Auto-room On",
          intro: [`${emojis.uptime} **Next run** <t:${nextRun}:R> · 00:00 and 12:00 UTC`],
          actorId: interaction.user.id,
          verb: "Turned on",
        }),
      );
    }
    await auditAutoRoom(interaction, ready.guild, ready.settings, ready.tournament.name, true, result.created);
  } catch (error) {
    await setAutoRoomRunning(ready.tournament.id, false).catch(() => undefined);
    const message =
      error instanceof TicketQueueError || error instanceof ChallongeError
        ? error.message
        : "Auto-room stayed off because the bracket could not be read.";
    await respondRoom(interaction, roomPanel("error", "Auto-room stayed off", [message]));
  }
}
