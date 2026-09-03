import type { ReleaseConfidence, ReleaseEvent, ReleasePrecision } from "./types";

/** Human label for a release date honouring its precision. Never invents a clock time. */
export function formatReleaseDate(
  date: string,
  precision: ReleasePrecision,
  locale = "en-US",
): string {
  if (precision === "tba") return "TBA";
  const d = new Date(date);
  switch (precision) {
    case "exact":
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    case "date":
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
    case "month":
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(d);
    case "quarter":
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    case "year":
      return String(d.getUTCFullYear());
  }
}

export function shortDayLabel(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(date)).toUpperCase();
}

export function shortDateLabel(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "2-digit" })
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
