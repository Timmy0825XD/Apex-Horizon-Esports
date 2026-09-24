import { ChannelType, type Guild } from "discord.js";

export const CATEGORY_CHANNEL_LIMIT = 50;

export async function categoryLoads(guild: Guild, categoryIds: string[]): Promise<Map<string, number>> {
  await guild.channels.fetch().catch(() => undefined);
  const loads = new Map<string, number>();
  for (const id of categoryIds) {
    const channel = guild.channels.cache.get(id);
    if (!channel || channel.type !== ChannelType.GuildCategory) {
      continue;
    }
    const children = guild.channels.cache.filter((child) => child.parentId === id).size;
    loads.set(id, children);
  }
  return loads;
}

export function freeSlots(loads: Map<string, number>): number {
  let slots = 0;
  for (const count of loads.values()) {
    slots += Math.max(0, CATEGORY_CHANNEL_LIMIT - count);
  }
  return slots;
}

export function nextOpenCategory(loads: Map<string, number>): string | null {
  for (const [id, count] of loads) {
    if (count < CATEGORY_CHANNEL_LIMIT) {
      return id;
    }
  }
  return null;
}
