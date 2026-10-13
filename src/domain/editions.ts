import type { ReleaseEvent, ReleaseKind } from "./types";

/** Playable releases that belong on the default radar. DLC and extras stay off until asked. */
export const DEFAULT_RADAR_KINDS: ReleaseKind[] = ["full", "early-access"];

const radarKinds = new Set<ReleaseKind>(DEFAULT_RADAR_KINDS);

export function isDefaultRadarEvent(event: Pick<ReleaseEvent, "kind">) {
  return radarKinds.has(event.kind);
}

export function relatedContent(events: ReleaseEvent[]) {
  return events
    .filter((event) => !isDefaultRadarEvent(event))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merges release events only when both fields of a trusted RadarEntry agree with the
 * current game's canonical ID. Base events win duplicate IDs.
 */
export function mergeGameReleaseEvents<
  E extends ReleaseEvent,
  Entry extends { game: { id?: string; slug?: string }; event: E },
>(baseEvents: E[], feedEntries: Entry[], game: { id?: string }): E[] {
  const targetId = game.id?.trim();
  const map = new Map<string, E>();
  for (const event of baseEvents) {
    map.set(event.id, event);
  }
  if (!targetId) return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of feedEntries) {
    if (entry.game?.id?.trim() !== targetId || entry.event.gameId?.trim() !== targetId) {
      continue;
    }
    if (!map.has(entry.event.id)) {
      map.set(entry.event.id, entry.event);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
