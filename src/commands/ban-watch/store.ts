import { Prisma, type BanRequest } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { playerSlotLabel } from "../../lib/sheet.js";
import { findTournamentRoster } from "../tournament/store.js";
import type { AnnouncedId, AnnouncementKind } from "./parse.js";

export type { BanRequest };

// A decision that crashed halfway leaves "deciding"; after this long another Organiser can take it again.
const STALE_DECISION_MS = 2 * 60 * 1000;

/** Store one request per ID. Skips IDs that already have an open request in this server. */
export async function createRequests(input: {
  guildId: string;
  channelId: string;
  sourceMessageId: string;
  kind: AnnouncementKind;
  ids: AnnouncedId[];
}): Promise<BanRequest[]> {
  // Skip IDs with an open request anywhere in the server, or any request from this same announcement.
  // This works with or without the unique index in Mongo; the index is a second guard.
  const open = await prisma.banRequest.findMany({
    where: {
      guildId: input.guildId,
      userId: { in: input.ids.map((entry) => entry.userId) },
      OR: [{ status: { in: ["pending", "deciding"] } }, { sourceMessageId: input.sourceMessageId }],
    },
    select: { userId: true },
  });
  const taken = new Set(open.map((row) => row.userId));
  const created: BanRequest[] = [];
  for (const entry of input.ids) {
    if (taken.has(entry.userId)) {
      continue;
    }
    try {
      created.push(
        await prisma.banRequest.create({
          data: {
            guildId: input.guildId,
            channelId: input.channelId,
            sourceMessageId: input.sourceMessageId,
            kind: input.kind,
            userId: entry.userId,
            reason: entry.reason,
          },
        }),
      );
    } catch (error) {
      // Same announcement delivered twice: the unique index keeps one request.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        throw error;
      }
    }
  }
  return created;
}

export async function findRequest(id: string): Promise<BanRequest | null> {
  return /^[a-f\d]{24}$/i.test(id) ? prisma.banRequest.findUnique({ where: { id } }) : null;
}

export async function setCardMessage(id: string, cardMessageId: string): Promise<void> {
  await prisma.banRequest.update({ where: { id }, data: { cardMessageId } });
}

export async function setPingMessage(guildId: string, sourceMessageId: string, pingMessageId: string): Promise<void> {
  await prisma.banRequest.updateMany({ where: { guildId, sourceMessageId }, data: { pingMessageId } });
}

/** Only one Organiser can decide a request; the loser of a double click gets false. */
export async function claimRequest(id: string): Promise<boolean> {
  const stale = new Date(Date.now() - STALE_DECISION_MS);
  const claimed = await prisma.banRequest.updateMany({
    where: { id, OR: [{ status: "pending" }, { status: "deciding", updatedAt: { lt: stale } }] },
    data: { status: "deciding" },
  });
  return claimed.count === 1;
}

export async function releaseRequest(id: string): Promise<void> {
  await prisma.banRequest.updateMany({ where: { id, status: "deciding" }, data: { status: "pending" } });
}

export async function closeRequest(id: string, status: "applied" | "dismissed", decidedBy: string): Promise<void> {
  await prisma.banRequest.update({ where: { id }, data: { status, decidedBy, decidedAt: new Date() } });
}

export async function setDuration(id: string, duration: string): Promise<BanRequest | null> {
  const changed = await prisma.banRequest.updateMany({ where: { id, status: "pending" }, data: { duration } });
  return changed.count === 1 ? prisma.banRequest.findUnique({ where: { id } }) : null;
}

export async function openRequestsFor(guildId: string, sourceMessageId: string): Promise<number> {
  return prisma.banRequest.count({ where: { guildId, sourceMessageId, status: { in: ["pending", "deciding"] } } });
}

export type RosterHit = { tournamentName: string; teamName: string; slot: string };

/** Where each Discord ID appears on the stored roster of a tournament registered in this server. */
export async function rosterHits(guildId: string, userIds: string[]): Promise<Map<string, RosterHit[]>> {
  const wanted = new Set(userIds);
  const hits = new Map<string, RosterHit[]>();
  if (wanted.size === 0) {
    return hits;
  }
  const tournaments = await prisma.tournament.findMany({ where: { guildId }, select: { id: true, name: true } });
  for (const tournament of tournaments) {
    const teams = (await findTournamentRoster(guildId, tournament.id).catch(() => null)) ?? [];
    for (const team of teams) {
      for (const player of team.players) {
        const id = player.discordId.trim();
        if (!wanted.has(id)) {
          continue;
        }
        const list = hits.get(id) ?? [];
        list.push({ tournamentName: tournament.name, teamName: team.teamName.trim() || player.discordTag || "—", slot: playerSlotLabel(player.slot) });
        hits.set(id, list);
      }
    }
  }
  return hits;
}
