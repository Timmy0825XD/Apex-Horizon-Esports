import type { Client } from "discord.js";
import { isAllowedGuild } from "../lib/allowed-guilds.js";
import { auditLogTitles, publishAudit } from "../lib/audit.js";
import { formatChannel } from "../lib/formatters.js";
import { openPendingTickets } from "../commands/room/open.js";
import { loadGuildSettings } from "../commands/settings/store.js";
import { isLateSlot, latestSlot } from "../commands/auto-room/slot.js";
import { claimAutoRoomSlot, listRunningAutoRooms } from "../commands/tournament/store.js";

let timer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
// Slot already swept by this process. Empty after a restart, so the first sweep recovers a missed slot.
let sweptSlot = "";

export function startAutoRoomWorker(client: Client): void {
  if (timer) {
    return;
  }
  const tick = () => {
    void flushSlot(client);
  };
  timer = setInterval(tick, 60_000);
  tick();
}

export function stopAutoRoomWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Each tournament stores the last slot it handled, so a slot missed while the bot was down
// is opened once when it comes back (only the latest one, never a backlog).
async function flushSlot(client: Client): Promise<void> {
  const actor = client.user;
  if (flushing || !actor) {
    return;
  }
  flushing = true;
  try {
    const now = new Date();
    const slot = latestSlot(now);
    if (slot.key === sweptSlot) {
      return;
    }
    const late = isLateSlot(slot, now);
    const tournaments = await listRunningAutoRooms();
    for (const tournament of tournaments) {
      if (!isAllowedGuild(tournament.guildId)) {
        continue;
      }
      try {
        // Claim before opening: a failed run is not retried every minute, as before.
        if ((await claimAutoRoomSlot(tournament.id, slot.key)) !== "claimed") {
          continue;
        }
        const guild =
          client.guilds.cache.get(tournament.guildId) ?? (await client.guilds.fetch(tournament.guildId));
        const result = await openPendingTickets(guild, tournament, undefined, actor);
        if (result.failed.length > 0) {
          console.error(
            `Auto-room left ${result.failed.length} matches unopened for ${tournament.name} (${tournament.id})`,
          );
        }
        if (result.created.length === 0) {
          continue;
        }
        const settings = await loadGuildSettings(guild.id);
        if (!settings) {
          continue;
        }
        const shown = result.created.slice(0, 15).map((ticket) => formatChannel(guild, ticket.channelId));
        const extra = result.created.length - shown.length;
        if (extra > 0) {
          shown.push(`*And **${extra}** more.*`);
        }
        await publishAudit({
          guild,
          channelId: settings.botLogsChannelId,
          title: auditLogTitles.botLogs,
          description: late
            ? `Auto-room recovered a missed slot and opened battle tickets for **${tournament.name}**.`
            : result.created.length === 1
              ? `Auto-room opened a battle ticket for **${tournament.name}**.`
              : `Auto-room opened battle tickets for **${tournament.name}**.`,
          details: [
            `**Tournament:** **${tournament.name}**`,
            `**Tickets created:** \`${result.created.length}\``,
            ...shown,
            late
              ? `**Slot:** \`${slotLabel(slot.startsAt)}\` *(recovered after the bot was offline)*`
              : `**Slot:** \`${slotLabel(slot.startsAt)}\``,
          ],
          actor,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Auto-room flush failed for ${tournament.name}: ${message}`, error);
      }
    }
    sweptSlot = slot.key;
  } finally {
    flushing = false;
  }
}

function slotLabel(startsAt: Date): string {
  return `${startsAt.toISOString().slice(0, 10)} ${String(startsAt.getUTCHours()).padStart(2, "0")}:00 UTC`;
}
