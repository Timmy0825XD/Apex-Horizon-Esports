/** Auto-room opens the queue at these UTC hours. */
const SLOT_HOURS = [0, 12] as const;

export type AutoRoomSlot = {
  /** Stored on the tournament once handled, e.g. `2026-11-01-12`. */
  key: string;
  startsAt: Date;
};

/** The most recent slot that has already started at `now`. */
export function latestSlot(now: Date): AutoRoomSlot {
  const hour = [...SLOT_HOURS].reverse().find((slotHour) => now.getUTCHours() >= slotHour) ?? 0;
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  return { key: `${startsAt.toISOString().slice(0, 10)}-${String(hour).padStart(2, "0")}`, startsAt };
}

/** The first slot that starts after `now`. */
export function nextSlotStart(now: Date): Date {
  const hour = SLOT_HOURS.find((slotHour) => now.getUTCHours() < slotHour);
  if (hour != null) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, SLOT_HOURS[0]));
}

/** A slot handled after its own hour was missed (the bot was down). */
export function isLateSlot(slot: AutoRoomSlot, now: Date): boolean {
  return now.getTime() - slot.startsAt.getTime() >= 60 * 60 * 1000;
}
