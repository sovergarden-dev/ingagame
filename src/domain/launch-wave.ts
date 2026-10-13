import type { RegionLaunch, ReleaseEvent } from "./types";

const TRUSTED = new Set(["confirmed", "high"]);
const BASE_GAME_KINDS = new Set(["full", "early-access"]);

/**
 * A launch wave is only real when several regions have their own exact,
 * trusted base-game timestamps. One global instant must not be expanded into cities.
 */
export function trustedLaunchWave(
  events: ReleaseEvent[],
  locale: string,
  userTimeZone?: string,
): RegionLaunch[] {
  const seen = new Set<string>();
  const rows: RegionLaunch[] = [];
  for (const event of events) {
    if (!BASE_GAME_KINDS.has(event.kind)) continue;
    if (event.precision !== "exact") continue;
    if (!TRUSTED.has(event.confidence)) continue;
    const region = event.region?.trim();
    const timeZone = event.timezone?.trim();
    if (!region || !timeZone) continue;
    if (seen.has(region)) continue;
    const instant = new Date(event.date);
    if (Number.isNaN(instant.getTime())) continue;
    let localTime: string;
    let timezoneLabel: string;
    try {
      localTime = new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }).format(instant);
      timezoneLabel =
        new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
          .formatToParts(instant)
          .find((part) => part.type === "timeZoneName")?.value ?? timeZone;
    } catch {
      continue;
    }
    seen.add(region);
    rows.push({
      region,
      timezoneLabel,
      localTime,
      isUserRegion: userTimeZone === timeZone,
    });
  }
  return rows.length >= 2 ? rows : [];
}
