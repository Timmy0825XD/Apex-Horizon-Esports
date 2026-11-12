import type { GuildSettings, Room } from "@prisma/client";
import {
  ChannelType,
  ComponentType,
  MessageFlags,
  type APIMessageTopLevelComponent,
  type ChatInputCommandInteraction,
  type Guild,
  type Message,
  type TextChannel,
} from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { attachResultsTranscript } from "../schedule/results.js";
import type { TournamentRecord } from "../tournament/fields.js";
import { respondRoom } from "../room/respond.js";
import { auditTranscriptRegenerated } from "./audit.js";
import { publishTicketTranscript, transcriptFilename } from "./transcript/index.js";
import { transcriptRegeneratedMessage, type TicketMatchFace } from "./view.js";

/** Pages of 100 read when looking for an old transcript or for links inside the ticket. */
const SCAN_PAGES = 10;

type Json = Record<string, unknown>;

function componentJson(message: Message): unknown[] {
  return message.components.map((component) => component.toJSON());
}

/** Every Text Display content of a message, in order. */
function textContents(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) textContents(child, out);
    return out;
  }
  if (!node || typeof node !== "object") {
    return out;
  }
  const record = node as Json;
  if (record.type === ComponentType.TextDisplay && typeof record.content === "string") {
    out.push(record.content);
  }
  for (const key of ["components", "accessory"]) {
    textContents(record[key], out);
  }
  return out;
}

function messageRef(url: string): { channelId: string; messageId: string } | null {
  const match = url.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
  return match ? { channelId: match[1], messageId: match[2] } : null;
}

async function readPages(channel: TextChannel, visit: (message: Message) => void): Promise<void> {
  let before: string | undefined;
  for (let page = 0; page < SCAN_PAGES; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, before, cache: false });
    if (batch.size === 0) {
      return;
    }
    batch.forEach(visit);
    before = [...batch.keys()].reduce((oldest, id) => (BigInt(id) < BigInt(oldest) ? id : oldest));
    if (batch.size < 100) {
      return;
    }
  }
}

/**
 * The bot's transcript posts for this ticket: each index card (it names the ticket channel) plus,
 * when the transcript was split, the part holders posted right before it.
 */
async function findOldTranscript(
  channel: TextChannel,
  ticketId: string,
  knownUrls: string[],
): Promise<{ indexes: Message[]; parts: Message[] }> {
  const botId = channel.client.user.id;
  const indexes = new Map<string, Message>();
  const isIndex = (message: Message) =>
    message.author.id === botId &&
    message.flags.has(MessageFlags.IsComponentsV2) &&
    textContents(componentJson(message)).some((text) => text.includes(`<#${ticketId}>`));

  for (const url of knownUrls) {
    const ref = messageRef(url);
    if (ref?.channelId !== channel.id) continue;
    const message = await channel.messages.fetch(ref.messageId).catch(() => null);
    if (message && message.author.id === botId) indexes.set(message.id, message);
  }
  await readPages(channel, (message) => {
    if (isIndex(message)) indexes.set(message.id, message);
  });

  const parts: Message[] = [];
  for (const index of indexes.values()) {
    const names = textContents(componentJson(index))
      .flatMap((text) => [...text.matchAll(/Part \d+: (.+?)\]\(/g)])
      .map((match) => match[1].replace(/\\(.)/g, "$1"));
    if (names.length === 0) continue;
    const earlier = await channel.messages
      .fetch({ limit: Math.min(100, names.length + 10), before: index.id, cache: false })
      .catch(() => null);
    earlier?.forEach((message) => {
      if (
        message.author.id === botId &&
        message.content.startsWith("Transcript part") &&
        names.some((name) => message.content.includes(`\`${name}\``))
      ) {
        parts.push(message);
      }
    });
  }
  return { indexes: [...indexes.values()], parts };
}

/** Swap old transcript links for the new one in a component tree; true when something changed. */
function relink(node: unknown, oldUrls: string[], newUrl: string): boolean {
  if (Array.isArray(node)) {
    return node.map((child) => relink(child, oldUrls, newUrl)).some(Boolean);
  }
  if (!node || typeof node !== "object") {
    return false;
  }
  const record = node as Json;
  let changed = false;
  if (record.type === ComponentType.Button && typeof record.url === "string" && oldUrls.includes(record.url)) {
    record.url = newUrl;
    changed = true;
  }
  if (record.type === ComponentType.TextDisplay && typeof record.content === "string") {
    const content = oldUrls.reduce((text, url) => text.split(url).join(newUrl), record.content);
    if (content !== record.content) {
      record.content = content;
      changed = true;
    }
  }
  for (const key of ["components", "accessory"]) {
    changed = relink(record[key], oldUrls, newUrl) || changed;
  }
  return changed;
}

/** Point the bot's messages in the ticket (the `/bracket upload` card) at the new transcript. */
async function relinkTicket(
  ticket: TextChannel,
  oldUrls: string[],
  newUrl: string,
  skipIds: Set<string>,
): Promise<{ updated: number; failed: number }> {
  const botId = ticket.client.user.id;
  const targets: Message[] = [];
  await readPages(ticket, (message) => {
    if (message.author.id === botId && !skipIds.has(message.id)) targets.push(message);
  });
  let updated = 0;
  let failed = 0;
  for (const message of targets) {
    const components = componentJson(message);
    if (!relink(components, oldUrls, newUrl)) continue;
    try {
      await message.edit({ components: components as APIMessageTopLevelComponent[], allowedMentions: { parse: [] } });
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Transcript link was not updated in message ${message.id}`, error);
    }
  }
  return { updated, failed };
}

export async function regenerateTranscript(input: {
  interaction: ChatInputCommandInteraction;
  ticket: TextChannel;
  guild: Guild;
  tournament: TournamentRecord;
  settings: GuildSettings;
  room: Room;
  match: TicketMatchFace;
}): Promise<void> {
  const { interaction, ticket, guild, tournament, room } = input;
  const target = await guild.channels.fetch(tournament.transcriptChannelId).catch(() => null);
  if (!target || target.type !== ChannelType.GuildText) {
    throw new Error("The tournament transcript channel is missing or is not a text channel.");
  }
  const schedule = await prisma.schedule.findUnique({
    where: { tournamentId_challongeMatchId: { tournamentId: tournament.id, challongeMatchId: room.challongeMatchId } },
  });
  const knownUrls = schedule?.results?.transcriptUrl ? [schedule.results.transcriptUrl] : [];

  // Found before publishing, so the new post is never mistaken for the old one.
  const old = await findOldTranscript(target, ticket.id, knownUrls);
  const newUrl = await publishTicketTranscript(guild, ticket, tournament.transcriptChannelId, {
    tournamentName: tournament.name,
    actor: interaction.user,
    filename: transcriptFilename(ticket.name),
    channelName: ticket.name,
  });

  const oldPosts = [...old.indexes, ...old.parts];
  const removed = (
    await Promise.all(oldPosts.map((message) => message.delete().then(() => true).catch(() => false)))
  ).filter(Boolean).length;

  let results: "updated" | "failed" | "none" = "none";
  if (schedule?.results) {
    results = await attachResultsTranscript(guild, tournament.id, room.challongeMatchId, newUrl)
      .then(() => "updated" as const)
      .catch((error) => {
        console.error(`Result posts were not relinked for match ${room.challongeMatchId}`, error);
        return "failed" as const;
      });
  }

  const oldUrls = [...new Set([...knownUrls, ...old.indexes.map((message) => message.url)])];
  const skipIds = new Set([schedule?.results?.ticketMessageId].filter((id): id is string => Boolean(id)));
  const relinked = oldUrls.length > 0 ? await relinkTicket(ticket, oldUrls, newUrl, skipIds) : { updated: 0, failed: 0 };

  await respondRoom(
    interaction,
    transcriptRegeneratedMessage({
      guild,
      tournamentName: tournament.name,
      matchId: room.challongeMatchId,
      match: input.match,
      transcriptChannelId: tournament.transcriptChannelId,
      transcriptUrl: newUrl,
      removed,
      oldFound: oldPosts.length,
      results,
      relinked,
      actorId: interaction.user.id,
    }),
  );
  await auditTranscriptRegenerated({
    interaction,
    guild,
    settings: input.settings,
    channelId: ticket.id,
    tournamentName: tournament.name,
    matchId: room.challongeMatchId,
    transcriptUrl: newUrl,
    removed,
  });
}
