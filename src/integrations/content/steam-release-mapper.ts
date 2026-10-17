import type { Game, PlatformId, RadarEntry, ReleaseEvent } from "../../domain/types.ts";
import { isGameSnapshot, isReleaseEvent } from "./feed.ts";

export interface RawSteamApp {
  id: number;
  name: string;
  header_image?: string;
  large_capsule_image?: string;
  tiny_image?: string;
  windows_available?: boolean;
  mac_available?: boolean;
  linux_available?: boolean;
  developer?: string;
  publisher?: string;
  short_description?: string;
  genres?: string[];
  release_date?:
    | {
        coming_soon?: boolean;
        date?: string;
      }
    | string;
}

export interface ParsedReleaseDate {
  date: string; // ISO 8601
  precision: "exact" | "date" | "month" | "quarter" | "year" | "tba";
  confidence: "confirmed" | "high" | "expected" | "tba";
  raw: string;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function slugify(text: string): string {
  const clean = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "game";
}

/**
 * Deterministic date parser for Steam release strings per Notion Sy06 architectural guidelines.
 * Rejects unstructured heuristics and binds each format to its semantic precision.
 */
export function parseSteamReleaseDate(raw: string | undefined): ParsedReleaseDate | null {
  if (!raw) return null;
  const clean = raw.trim();
  if (!clean) return null;

  // 1. Pure TBA / Coming Soon without an announced window is excluded from the release radar
  // Per Notion Sy06 integrity rule: "Không bịa timestamp để qua validation. Tạm không đưa mục đó vào feed."
  if (/^(coming soon|to be announced|tba|tbd)$/i.test(clean)) {
    return null;
  }

  // 2. Exact ISO / Date: "YYYY-MM-DD"
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const dateStr = `${y}-${m}-${d}T00:00:00.000Z`;
    if (!Number.isNaN(Date.parse(dateStr))) {
      return { date: dateStr, precision: "date", confidence: "confirmed", raw: clean };
    }
  }

  // 3. Day Month Year: "24 Oct, 2026" or "24 October 2026"
  const dmyMatch = clean.match(/^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})$/);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1] ?? "", 10);
    const monthKey = (dmyMatch[2] ?? "").toLowerCase();
    const year = Number.parseInt(dmyMatch[3] ?? "", 10);
    const month = MONTH_NAMES[monthKey];
    if (month && day >= 1 && day <= 31) {
      const padM = String(month).padStart(2, "0");
      const padD = String(day).padStart(2, "0");
      const dateStr = `${year}-${padM}-${padD}T00:00:00.000Z`;
      if (!Number.isNaN(Date.parse(dateStr))) {
        return { date: dateStr, precision: "date", confidence: "confirmed", raw: clean };
      }
    }
  }

  // 4. Month Day Year: "Oct 24, 2026" or "October 24 2026"
  const mdyMatch = clean.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyMatch) {
    const monthKey = (mdyMatch[1] ?? "").toLowerCase();
    const day = Number.parseInt(mdyMatch[2] ?? "", 10);
    const year = Number.parseInt(mdyMatch[3] ?? "", 10);
    const month = MONTH_NAMES[monthKey];
    if (month && day >= 1 && day <= 31) {
      const padM = String(month).padStart(2, "0");
      const padD = String(day).padStart(2, "0");
      const dateStr = `${year}-${padM}-${padD}T00:00:00.000Z`;
      if (!Number.isNaN(Date.parse(dateStr))) {
        return { date: dateStr, precision: "date", confidence: "confirmed", raw: clean };
      }
    }
  }

  // 5. Quarter Year: "Q1 2027", "Q4 2026"
  const qMatch = clean.match(/^Q([1-4])\s+(\d{4})$/i);
  if (qMatch) {
    const quarter = Number.parseInt(qMatch[1] ?? "", 10);
    const year = Number.parseInt(qMatch[2] ?? "", 10);
    const startMonth = (quarter - 1) * 3 + 1;
    const padM = String(startMonth).padStart(2, "0");
    return {
      date: `${year}-${padM}-01T00:00:00.000Z`,
      precision: "quarter",
      confidence: "expected",
      raw: clean,
    };
  }

  // 6. Month Year: "October 2026", "Oct 2026"
  const myMatch = clean.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (myMatch) {
    const monthKey = (myMatch[1] ?? "").toLowerCase();
    const year = Number.parseInt(myMatch[2] ?? "", 10);
    const month = MONTH_NAMES[monthKey];
    if (month) {
      const padM = String(month).padStart(2, "0");
      return {
        date: `${year}-${padM}-01T00:00:00.000Z`,
        precision: "month",
        confidence: "high",
        raw: clean,
      };
    }
  }

  // 7. Year Only: "2026"
  const yMatch = clean.match(/^(\d{4})$/);
  if (yMatch) {
    const year = Number.parseInt(yMatch[1] ?? "", 10);
    return {
      date: `${year}-01-01T00:00:00.000Z`,
      precision: "year",
      confidence: "expected",
      raw: clean,
    };
  }

  return null;
}

/**
 * Maps a raw Steam application item to an Inga RadarEntry.
 * Strictly checks DTO validation rules. Returns null on any contract mismatch.
 */
export function mapSteamAppToRadarEntry(app: RawSteamApp): RadarEntry | null {
  if (!app || typeof app.id !== "number" || app.id <= 0 || !app.name?.trim()) {
    return null;
  }

  const rawDateStr =
    typeof app.release_date === "string"
      ? app.release_date
      : (app.release_date?.date ?? (app.release_date?.coming_soon ? "Coming Soon" : ""));

  const parsedDate = parseSteamReleaseDate(rawDateStr);
  if (!parsedDate) {
    return null;
  }

  const gameId = `steam-${app.id}`;
  const eventId = `rel-steam-${app.id}`;
  const slug = `${slugify(app.name)}-${app.id}`;
  const coverUrl =
    app.header_image ||
    app.large_capsule_image ||
    app.tiny_image ||
    "https://cdn.akamai.steamstatic.com/steam/apps/header.jpg";

  const platforms: PlatformId[] = ["pc", "steam"];
  if (app.mac_available) platforms.push("pc"); // PC family includes macOS on Steam
  if (app.linux_available) platforms.push("pc");

  const releaseEvent: ReleaseEvent = {
    id: eventId,
    gameId,
    date: parsedDate.date,
    precision: parsedDate.precision,
    confidence: parsedDate.confidence,
    kind: "full",
    state: parsedDate.precision === "tba" ? "upcoming" : "upcoming",
    platforms,
    note: `Source: Steam Storefront (${parsedDate.raw})`,
  };

  const game: Game = {
    id: gameId,
    slug,
    title: app.name.trim(),
    developer: app.developer?.trim() || "Independent Developer",
    publisher: app.publisher?.trim() || "Self-Published",
    summary:
      app.short_description?.trim() ||
      `Upcoming release on Steam: ${app.name.trim()}. Track launch waves and notifications on Inga.`,
    genres: app.genres && app.genres.length > 0 ? app.genres : ["Action", "Indie"],
    coverUrl,
    platforms,
    releaseEvents: [releaseEvent],
    steamAppId: app.id,
  };

  // Full contract verification against feed schema validators
  if (!isGameSnapshot(game) || !isReleaseEvent(releaseEvent)) {
    return null;
  }

  return { game, event: releaseEvent };
}
