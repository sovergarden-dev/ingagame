import { CONFIDENCE_ORDER } from "./release.ts";
import type { ReleaseEvent } from "./types";

function conflictKey(event: ReleaseEvent) {
  return [event.gameId, event.kind, [...event.platforms].sort().join(",")].join("|");
}

/** One release per game, kind, and platform set. Higher confidence wins. Ties use the event id. */
export function radarWinners<T extends { event: ReleaseEvent }>(entries: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = conflictKey(entry.event);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  const winners: T[] = [];
  for (const list of groups.values()) {
    const ranked = [...list].sort((a, b) => {
      const confidence =
        CONFIDENCE_ORDER.indexOf(a.event.confidence) - CONFIDENCE_ORDER.indexOf(b.event.confidence);
      if (confidence !== 0) return confidence;
      return a.event.id.localeCompare(b.event.id);
    });
    const winner = ranked[0];
    if (winner) winners.push(winner);
  }
  return winners;
}

export type ReleaseConflict = { event: ReleaseEvent; winnerId: string };

/** Losing dates for the same game, kind, and platforms. Same date is a duplicate, not a conflict. */
export function releaseConflicts(events: ReleaseEvent[]): ReleaseConflict[] {
  const winners = new Map(
    radarWinners(events.map((event) => ({ event }))).map((entry) => [
      conflictKey(entry.event),
      entry.event,
    ]),
  );
  const conflicts: ReleaseConflict[] = [];
  for (const event of events) {
    const winner = winners.get(conflictKey(event));
    if (!winner || winner.id === event.id || winner.date === event.date) continue;
    conflicts.push({ event, winnerId: winner.id });
  }
  return conflicts;
}
