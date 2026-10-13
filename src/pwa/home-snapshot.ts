import type { Game, PlatformId, ReleaseEvent, ReleasePrecision } from "@/domain/types";

export const HOME_SNAPSHOT_VERSION = 1;
export const HOME_SNAPSHOT_KEY = "inga.home-snapshot";

const PRECISIONS = new Set<ReleasePrecision>(["exact", "date", "month", "quarter", "year", "tba"]);

export type HomeSnapshot = {
  version: typeof HOME_SNAPSHOT_VERSION;
  savedAt: string;
  slug: string;
  title: string;
  /** Present only when the catalogue recorded an original-language title. */
  originalTitle?: string;
  summary: string;
  coverUrl: string;
  developer: string;
  publisher: string;
  platforms: PlatformId[];
  event: ReleaseEvent;
};

function isEvent(value: unknown): value is ReleaseEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as ReleaseEvent;
  return (
    typeof event.id === "string" &&
    typeof event.date === "string" &&
    PRECISIONS.has(event.precision) &&
    typeof event.gameId === "string"
  );
}

export function parseHomeSnapshot(raw: string | null): HomeSnapshot | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as HomeSnapshot;
    if (data.version !== HOME_SNAPSHOT_VERSION) return null;
    if (
      typeof data.slug !== "string" ||
      typeof data.title !== "string" ||
      typeof data.coverUrl !== "string"
    ) {
      return null;
    }
    if (!isEvent(data.event)) return null;
    if (data.originalTitle !== undefined && typeof data.originalTitle !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export function serializeHomeSnapshot(snapshot: HomeSnapshot): string {
  return JSON.stringify({ ...snapshot, version: HOME_SNAPSHOT_VERSION });
}

/** IndexedDB wins. A missing database row falls back to the older local copy. */
export function chooseHomeSnapshot(stored: HomeSnapshot | null, legacy: HomeSnapshot | null) {
  return stored ?? legacy;
}

export function gameFromHomeSnapshot(snapshot: HomeSnapshot): Game {
  return {
    id: snapshot.event.gameId,
    slug: snapshot.slug,
    title: snapshot.title,
    ...(snapshot.originalTitle ? { originalTitle: snapshot.originalTitle } : {}),
    summary: snapshot.summary,
    developer: snapshot.developer,
    publisher: snapshot.publisher,
    genres: [],
    coverUrl: snapshot.coverUrl,
    platforms: snapshot.platforms,
    releaseEvents: [snapshot.event],
  };
}
