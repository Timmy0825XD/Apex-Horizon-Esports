import type { Guild, TextChannel } from "discord.js";
import { prisma } from "../../lib/prisma.js";
import { categoryLoads, nextOpenCategory } from "../room/categories.js";
import type { TournamentRecord } from "../tournament/fields.js";

const SILENCE = {
  ViewChannel: true,
  ReadMessageHistory: true,
  SendMessages: false,
  AddReactions: false,
  AttachFiles: false,
  EmbedLinks: false,
  UseExternalEmojis: false,
} as const;

const CHAT = {
  ViewChannel: true,
  SendMessages: true,
  EmbedLinks: true,
  AttachFiles: true,
  ReadMessageHistory: true,
  AddReactions: true,
  UseExternalEmojis: true,
} as const;

async function editAccess(channel: TextChannel, guildId: string, access: typeof SILENCE | typeof CHAT): Promise<void> {
  const overwrites = channel.permissionOverwrites.cache.filter((overwrite) => overwrite.id !== guildId);
  await Promise.all(overwrites.map((overwrite) => channel.permissionOverwrites.edit(overwrite.id, access)));
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
    await editAccess(channel, guild.id, SILENCE);
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
  try {
    await prisma.room.delete({ where: { id: roomId } });
  } catch {
    await prisma.room.delete({ where: { id: roomId } });
  }
}
