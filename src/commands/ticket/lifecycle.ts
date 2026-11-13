import { OverwriteType, type Guild, type TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { categoryLoads, nextOpenCategory } from "../room/categories.js";
import type { TournamentRecord } from "../tournament/fields.js";

const CHAT = {
  ViewChannel: true,
  SendMessages: true,
  EmbedLinks: true,
  AttachFiles: true,
  ReadMessageHistory: true,
  AddReactions: true,
  UseExternalEmojis: true,
} as const;

const LOCKED = { ViewChannel: false } as const;

/** Judges and recorders seated on this ticket's schedules; they only get access through a seat. */
async function staffIds(channelId: string): Promise<Set<string>> {
  const schedules = await prisma.schedule.findMany({
    where: { channelId },
    select: { judgeId: true, recorderId: true },
  });
  return new Set(schedules.flatMap((row) => [row.judgeId, row.recorderId]).filter((id): id is string => Boolean(id)));
}

/**
 * Roles (organiser, helper) keep full chat whether the ticket is open or closed. Seated staff lose
 * their overwrite. Any other member (the captains) gets `memberAccess`: locked out while closed,
 * back in chat when reopened.
 */
async function editAccess(
  channel: TextChannel,
  guildId: string,
  memberAccess: typeof LOCKED | typeof CHAT,
): Promise<void> {
  const staff = await staffIds(channel.id);
  const botId = channel.client.user.id;
  const overwrites = [...channel.permissionOverwrites.cache.values()].filter(
    (overwrite) => overwrite.id !== guildId && overwrite.id !== botId,
  );
  await Promise.all(
    overwrites.map((overwrite) => {
      if (overwrite.type === OverwriteType.Role) {
        return overwrite.edit(CHAT, "Battle ticket access");
      }
      if (staff.has(overwrite.id)) {
        return overwrite.delete("Battle ticket staff access removed");
      }
      return overwrite.edit(memberAccess, "Battle ticket access");
    }),
  );
}

async function move(channel: TextChannel, categoryId: string): Promise<void> {
  await channel.setParent(categoryId, { lockPermissions: false, reason: "Battle ticket category" });
}

export async function closeTicket(
  channel: TextChannel,
  guild: Guild,
  tournament: TournamentRecord,
): Promise<string> {
  const loads = await categoryLoads(
    guild,
    [tournament.closedTicketCategoryId, tournament.closeTicketCategory2Id].filter((id): id is string => Boolean(id)),
  );
  const categoryId = nextOpenCategory(loads);
  if (!categoryId) {
    throw new Error("Closed-ticket categories are missing or full (**50** channels).");
  }
  const previous = channel.parentId;
  await move(channel, categoryId);
  try {
    await editAccess(channel, guild.id, LOCKED);
  } catch (error) {
    if (previous) {
      await channel.setParent(previous, { lockPermissions: false }).catch(() => undefined);
    }
    throw error;
  }
  await prisma.room.update({
    where: { channelId: channel.id },
    data: { status: "closed" },
  });
  return categoryId;
}

export async function reopenTicket(
  channel: TextChannel,
  guild: Guild,
  tournament: TournamentRecord,
  homeCategoryId: string,
): Promise<string> {
  const loads = await categoryLoads(guild, tournament.ticketOpenCategoryIds);
  const preferred = loads.has(homeCategoryId) && (loads.get(homeCategoryId) ?? 0) < 50 ? homeCategoryId : null;
  const categoryId = preferred ?? nextOpenCategory(loads);
  if (!categoryId) {
    throw new Error("Open-ticket categories are missing or full (**50** channels).");
  }
  const previous = channel.parentId;
  await move(channel, categoryId);
  try {
    await editAccess(channel, guild.id, CHAT);
  } catch (error) {
    if (previous) {
      await channel.setParent(previous, { lockPermissions: false }).catch(() => undefined);
    }
    throw error;
  }
  await prisma.room.update({
    where: { channelId: channel.id },
    data: { status: "open", categoryId },
  });
  return categoryId;
}

export async function deleteTicket(channel: TextChannel, roomId: string): Promise<void> {
  await channel.delete("Battle ticket deleted");
  // Idempotent: a row already gone is not an error once the channel is deleted.
  await prisma.room.deleteMany({ where: { id: roomId } });
}
