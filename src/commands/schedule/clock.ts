export type ClockParts = {
  hour: number;
  minute: number;
  day: number;
  month: number;
  year: number;
};

const TEN_MINUTES = 10 * 60 * 1000;

export function utcFromParts(parts: ClockParts): Date | null {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day ||
    date.getUTCHours() !== parts.hour ||
    date.getUTCMinutes() !== parts.minute
  ) {
    return null;
  }
  return date;
}

export function isAtLeastTenMinutesAhead(when: Date, now = Date.now()): boolean {
  return when.getTime() - now >= TEN_MINUTES;
}

export function tenMinutesBefore(when: Date): Date {
  return new Date(when.getTime() - TEN_MINUTES);
}
