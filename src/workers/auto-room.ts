import type { Client } from "discord.js";
import { isAllowedGuild } from "../lib/allowed-guilds.js";
import { auditLogTitles, publishAudit } from "../lib/audit.js";
import { ChallongeError } from "../lib/challonge.js";
import { formatChannel } from "../lib/formatters.js";
import { TicketQueueError } from "../commands/room/bracket.js";
import { openPendingTickets } from "../commands/room/open.js";
import { loadGuildSettings } from "../commands/settings/store.js";
import { listRunningAutoRooms } from "../commands/tournament/store.js";

const SLOT_HOURS = new Set([0, 12]);
let timer: ReturnType<typeof setInterval> | null = null;
let lastSlot = "";
let flushing = false;

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

function slotKey(now: Date): string | null {
  const hour = now.getUTCHours();
  if (!SLOT_HOURS.has(hour)) {
    return null;
  }
  return `${now.toISOString().slice(0, 10)}-${String(hour).padStart(2, "0")}`;
}

async function flushSlot(client: Client): Promise<void> {
  const key = slotKey(new Date());
  const actor = client.user;
  if (!key || key === lastSlot || flushing || !actor) {
    return;
  }
  lastSlot = key;
  flushing = true;
  try {
    const tournaments = await listRunningAutoRooms();
    for (const tournament of tournaments) {
      if (!isAllowedGuild(tournament.guildId)) {
        continue;
      }
      try {
        const guild =
          client.guilds.cache.get(tournament.guildId) ?? (await client.guilds.fetch(tournament.guildId));
        const result = await openPendingTickets(guild, tournament);
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
          description:
            result.created.length === 1
              ? `Auto-room opened a battle ticket for **${tournament.name}**.`
              : `Auto-room opened battle tickets for **${tournament.name}**.`,
          details: [
            `**Tournament:** **${tournament.name}**`,
            `**Tickets created:** \`${result.created.length}\``,
            ...shown,
            `**When:** \`00:00 / 12:00 UTC\``,
          ],
          actor,
        });
      } catch (error) {
        const message = error instanceof TicketQueueError || error instanceof ChallongeError ? error.message : "unknown";
        console.error(`Auto-room flush failed for ${tournament.name}: ${message}`);
      }
    }
  } finally {
    flushing = false;
  }
}
