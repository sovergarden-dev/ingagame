import type { ReleaseConfidence, ReleaseEvent, ReleasePrecision } from "./types";

/** IANA zone, or UTC when the string is not a real timezone. */
export function safeTimeZone(timeZone: string | undefined): string {
  if (!timeZone?.trim()) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Human label for a release date honouring its precision.
 * Callers that pass a timezone must do it only after hydration.
 */
export function formatReleaseDate(
  date: string,
  precision: ReleasePrecision,
  locale = "en-US",
  timeZone = "UTC",
): string {
  if (precision === "tba") return "TBA";
  const d = new Date(date);
  const zone = safeTimeZone(timeZone);
  switch (precision) {
    case "exact":
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: zone,
      }).format(d);
    case "date":
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: zone }).format(d);
    case "month":
      return new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: zone,
      }).format(d);
    case "quarter":
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    case "year":
      return String(d.getUTCFullYear());
  }
}

export function shortDayLabel(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    .format(new Date(date))
    .toUpperCase();
}

export function shortDateLabel(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "2-digit", timeZone: "UTC" })
    .format(new Date(date))
    .toUpperCase();
}

export function dayKey(date: string) {
  return date.slice(0, 10);
}

export const CONFIDENCE_ORDER: ReleaseConfidence[] = [
  "confirmed",
  "high",
  "expected",
  "unconfirmed",
  "tba",
];

export function isCountdownable(event: ReleaseEvent) {
  return event.precision === "exact" || event.precision === "date";
}

function zoneParts(date: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** Exclusive end of the known release window. Past this, the date is no longer "upcoming". */
function releaseWindowEnd(event: ReleaseEvent): number {
  if (event.precision === "tba") return Number.POSITIVE_INFINITY;
  const zone = event.timezone?.trim() || "UTC";
  let year: number;
  let month: number;
  let day: number;
  try {
    ({ year, month, day } = zoneParts(event.date, zone));
  } catch {
    return Number.NaN;
  }
  if (event.precision === "exact") return new Date(event.date).getTime();
  if (event.precision === "date") return Date.UTC(year, month - 1, day + 1);
  if (event.precision === "month") return Date.UTC(year, month, 1);
  if (event.precision === "quarter") return Date.UTC(year, Math.floor((month - 1) / 3) * 3 + 3, 1);
  if (event.precision === "year") return Date.UTC(year + 1, 0, 1);
  return Number.POSITIVE_INFINITY;
}

/** TBA stays upcoming. A passed exact time or closed date/month/quarter/year window does not. */
export function isReleaseStillAhead(event: ReleaseEvent, nowMs: number) {
  if (event.state === "available") return false;
  const end = releaseWindowEnd(event);
  if (Number.isNaN(end)) return true;
  return nowMs < end;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  elapsed: boolean;
}

export function countdownFrom(target: string, now: number): CountdownParts {
  const diff = new Date(target).getTime() - now;
  const elapsed = diff <= 0;
  const abs = Math.max(diff, 0);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs / 3_600_000) % 24),
    minutes: Math.floor((abs / 60_000) % 60),
    seconds: Math.floor((abs / 1000) % 60),
    elapsed,
  };
}
