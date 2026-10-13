import type { ReleaseEvent } from "./types";
import { calendarEventUid } from "./calendar-feed.ts";

export function canExportCalendar(event: ReleaseEvent) {
  return event.precision === "exact" || event.precision === "date";
}

function icsEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/[,;]/g, (ch) => `\\${ch}`);
}

function calendarDate(date: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${pick("year")}${pick("month")}${pick("day")}`;
}

function nextDate(ymd: string) {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const day = Number(ymd.slice(6, 8));
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function utcStamp(date: string) {
  return new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** ICS for one release. Date precision is all-day. Month/quarter/year/TBA are refused. */
export function releaseEventIcs(
  event: ReleaseEvent,
  title: string,
  now = new Date(),
): string | null {
  if (!canExportCalendar(event)) return null;
  const stamp = utcStamp(now.toISOString());
  const summary = icsEscape(title);
  let when: string;
  if (event.precision === "date") {
    const zone = event.timezone?.trim() || "UTC";
    const start = calendarDate(event.date, zone);
    when = `DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${nextDate(start)}`;
  } else {
    when = `DTSTART:${utcStamp(event.date)}`;
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Inga//Release//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${icsEscape(calendarEventUid(event.id))}`,
    `DTSTAMP:${stamp}`,
    when,
    `SUMMARY:${summary}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** One calendar for tracked releases. Coarser than a date is omitted. UID is the release id. */
export function watchlistCalendarIcs(
  entries: { event: ReleaseEvent; title: string }[],
  now = new Date(),
): string {
  const stamp = utcStamp(now.toISOString());
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const { event, title } of entries) {
    if (seen.has(event.id) || !canExportCalendar(event)) continue;
    seen.add(event.id);
    const summary = icsEscape(title);
    const when =
      event.precision === "date"
        ? `DTSTART;VALUE=DATE:${calendarDate(event.date, event.timezone?.trim() || "UTC")}\r\nDTEND;VALUE=DATE:${nextDate(calendarDate(event.date, event.timezone?.trim() || "UTC"))}`
        : `DTSTART:${utcStamp(event.date)}`;
    blocks.push(
      [
        "BEGIN:VEVENT",
        `UID:${icsEscape(calendarEventUid(event.id))}`,
        `DTSTAMP:${stamp}`,
        when,
        `SUMMARY:${summary}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Inga//Release//EN",
    "CALSCALE:GREGORIAN",
    ...blocks,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function primaryRelease(events: ReleaseEvent[], now = Date.now()): ReleaseEvent | undefined {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const mains = sorted.filter((event) => event.kind === "full" || event.kind === "early-access");
  const pool = mains.length ? mains : sorted;
  const upcoming = pool.find((event) => new Date(event.date).getTime() >= now);
  return upcoming ?? pool[pool.length - 1];
}
