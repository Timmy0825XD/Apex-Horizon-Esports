import type { ChatInputCommandInteraction } from "discord.js";
import { ChallongeError } from "../../lib/challonge.js";
import { formatHelpEntry } from "../../lib/formatters.js";
import { roomCommandIdFor } from "../../lib/register-slash.js";
import { auditAutoRoom } from "./audit.js";
import { TicketQueueError } from "./bracket.js";
import { openPendingTickets } from "./open.js";
import { prepareTournament } from "./prepare.js";
import { deferRoom, respondRoom } from "./respond.js";
import { creationReport } from "./report.js";
import { roomPanel } from "./view.js";
import { escapeDiscord } from "./labels.js";
import { setAutoRoomRunning } from "../tournament/store.js";

/** `/room auto`: turns the auto-room worker on or off for one tournament. */
export async function handleRoomAutoSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  const ready = await prepareTournament(interaction, "change auto-room");
  if (!ready) {
    return;
  }

  const status = interaction.options.getBoolean("status", true);
  const create = formatHelpEntry("room create", roomCommandIdFor(interaction.guildId));

  if (status === ready.tournament.autoRoomRunning) {
    await respondRoom(
      interaction,
      roomPanel(
        "info",
        status ? "Auto-room is already on" : "Auto-room is already off",
        status
          ? [
              `**${ready.tournament.name}** already opens battle tickets on the UTC schedule.`,
              `Matches that become ready later wait for **00:00** or **12:00** UTC. ${create} opens that queue now.`,
            ]
          : [`**${ready.tournament.name}** is not opening new battle tickets.`],
      ),
    );
    return;
  }

  if (!status) {
    await setAutoRoomRunning(ready.tournament.id, false);
    await respondRoom(
      interaction,
      roomPanel("success", "Auto-room turned off", [
        `**${ready.tournament.name}** will not open new battle tickets.`,
        "Tickets that already exist stay where they are.",
      ]),
    );
    await auditAutoRoom(interaction, ready.guild, ready.settings, ready.tournament.name, false, []);
    return;
  }

  await deferRoom(interaction, false);
  try {
    await setAutoRoomRunning(ready.tournament.id, true);
    const result = await openPendingTickets(ready.guild, ready.tournament, undefined, interaction.user);
    const schedule = `Matches that open later wait for **00:00** or **12:00** UTC. ${create} opens that queue now.`;
    if (result.created.length === 0 && result.failed.length === 0) {
      await respondRoom(
        interaction,
        roomPanel("success", "Auto-room turned on", [
          `**${escapeDiscord(ready.tournament.name)}** will open battle tickets from the bracket.`,
          "No open match was waiting, so nothing was created just now.",
          schedule,
        ]),
      );
    } else {
      await respondRoom(
        interaction,
        creationReport(ready.guild, ready.tournament.name, result, {
          title: "Auto-room turned on",
          intro: [`**${escapeDiscord(ready.tournament.name)}** will open battle tickets from the bracket.`, schedule],
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
