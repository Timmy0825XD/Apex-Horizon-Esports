export const BAN_DURATIONS = ["7 days", "1 month", "2 months", "6 months", "Permanent"] as const;

export type BanDuration = (typeof BAN_DURATIONS)[number];

export const banDurationChoices = BAN_DURATIONS.map((duration) => ({
  name: duration,
  value: duration,
}));

export function isBanDuration(value: string): value is BanDuration {
  return (BAN_DURATIONS as readonly string[]).includes(value);
}

export function expiresAtFor(duration: BanDuration, from: Date): Date | null {
  if (duration === "Permanent") {
    return null;
  }

  const expires = new Date(from.getTime());
  if (duration === "7 days") {
    expires.setUTCDate(expires.getUTCDate() + 7);
    return expires;
  }
  if (duration === "1 month") {
    expires.setUTCMonth(expires.getUTCMonth() + 1);
    return expires;
  }
  if (duration === "2 months") {
    expires.setUTCMonth(expires.getUTCMonth() + 2);
    return expires;
  }
  expires.setUTCMonth(expires.getUTCMonth() + 6);
  return expires;
}
