import type { ReleaseEvent } from "./types.ts";

/** Stable across date changes so a calendar client updates the same event. */
export function calendarEventUid(eventId: string) {
  return `${eventId}@inga`;
}

/** A feed token is high-entropy and is not an email or account id. */
export function isRevocableFeedToken(token: string) {
  return /^[A-Za-z0-9_-]{32,}$/.test(token);
}

export function calendarFeedEvents<T extends { event: ReleaseEvent }>(
  entries: T[],
  scope: { fullOnly: boolean },
): T[] {
  const seen = new Set<string>();
  return entries.filter(({ event }) => {
    if (seen.has(event.id)) return false;
    if (event.precision !== "exact" && event.precision !== "date") return false;
    if (scope.fullOnly && event.kind !== "full" && event.kind !== "early-access") return false;
    seen.add(event.id);
    return true;
  });
}
