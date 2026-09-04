import cover1 from "@/assets/cover-1.jpg";
import cover2 from "@/assets/cover-2.jpg";
import cover3 from "@/assets/cover-3.jpg";
import cover4 from "@/assets/cover-4.jpg";
import cover5 from "@/assets/cover-5.jpg";
import cover6 from "@/assets/cover-6.jpg";
import cover7 from "@/assets/cover-7.jpg";
import cover8 from "@/assets/cover-8.jpg";
import heroBackdrop from "@/assets/hero-aetherfall.jpg";

import type { Article, Deal, Game, Giveaway, RegionLaunch, ReleaseEvent, Video } from "./types";

export const HERO_BACKDROP = heroBackdrop;

/**
 * Centralized mock data. Every screen reads from here so a provider layer can
 * later replace this module without touching components.
 */

interface GameSeed {
  slug: string;
  title: string;
  originalTitle?: string;
  developer: string;
  publisher: string;
  summary: string;
  genres: string[];
  cover: string;
  events: Omit<ReleaseEvent, "id" | "gameId">[];
  hypeScore?: number;
  criticScore?: number;
}

const seeds: GameSeed[] = [
  {
    slug: "aetherfall-eclipse",
    title: "Aetherfall: Eclipse",
    developer: "Nightspire Studio",
    publisher: "Vantage Interactive",
    summary:
      "A shattered world. An ancient force awakens. Choose your path and shape the eclipse in an open-ended action RPG built around irreversible decisions.",
    genres: ["Action RPG", "Open World"],
    cover: cover2,
    hypeScore: 96,
    events: [
      {
        date: "2026-09-10T09:00:00+07:00",
        precision: "exact",
        confidence: "confirmed",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "steam", "playstation", "xbox"],
        timezone: "Asia/Ho_Chi_Minh",
        source: "Publisher announcement",
      },
      {
        date: "2026-11-20T00:00:00Z",
        precision: "month",
        confidence: "expected",
        kind: "dlc",
        state: "upcoming",
        platforms: ["pc", "playstation", "xbox"],
        note: "Season pass chapter one",
      },
    ],
  },
  {
    slug: "neon-arterial",
    title: "Neon Arterial",
    developer: "Halfstep Games",
    publisher: "Halfstep Games",
    summary: "Street-level racing through a rain-soaked megacity that rebuilds itself every night.",
    genres: ["Racing", "Arcade"],
    cover: cover1,
    hypeScore: 74,
    events: [
      {
        date: "2026-09-03T18:00:00+07:00",
        precision: "exact",
        confidence: "confirmed",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "steam", "playstation"],
      },
    ],
  },
  {
    slug: "harborlight",
    title: "Harborlight",
    developer: "Small Tide",
    publisher: "Wanderpost",
    summary: "Build an island town, run the airship route, and keep the harbor lit through winter.",
    genres: ["Life Sim", "Cozy"],
    cover: cover3,
    hypeScore: 61,
    events: [
      {
        date: "2026-09-04T00:00:00Z",
        precision: "date",
        confidence: "high",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "switch", "mobile"],
      },
    ],
  },
  {
    slug: "orbital-drift-ii",
    title: "Orbital Drift II",
    developer: "Cold Vector",
    publisher: "Meridian Games",
    summary: "Run a failing station above a gas giant while the supply chain quietly collapses.",
    genres: ["Simulation", "Survival"],
    cover: cover4,
    hypeScore: 83,
    events: [
      {
        date: "2026-09-05T00:00:00Z",
        precision: "date",
        confidence: "expected",
        kind: "early-access",
        state: "upcoming",
        platforms: ["pc", "steam"],
      },
    ],
  },
  {
    slug: "emberfall-crown",
    title: "Emberfall Crown",
    developer: "Blackreach",
    publisher: "Vantage Interactive",
    summary: "A punishing dark-fantasy action game about outlasting things that do not tire.",
    genres: ["Soulslike", "Action"],
    cover: cover5,
    hypeScore: 91,
    events: [
      {
        date: "2026-09-06T00:00:00Z",
        precision: "date",
        confidence: "high",
        kind: "full",
        state: "delayed",
        platforms: ["pc", "playstation", "xbox"],
        delayDays: 7,
        previousDate: "2026-08-30T00:00:00Z",
        note: "Pushed to finish console certification",
      },
    ],
  },
  {
    slug: "tidewrought",
    title: "Tidewrought",
    originalTitle: "潮織り",
    developer: "Lumen Reef",
    publisher: "Lumen Reef",
    summary: "Dive a bioluminescent drowned city and trade its light for passage home.",
    genres: ["Adventure", "Exploration"],
    cover: cover6,
    hypeScore: 68,
    events: [
      {
        date: "2026-09-07T00:00:00Z",
        precision: "date",
        confidence: "unconfirmed",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "switch2", "vr"],
      },
    ],
  },
  {
    slug: "rooftop-runners",
    title: "Rooftop Runners",
    developer: "Pixel Cartel",
    publisher: "Pixel Cartel",
    summary: "A precision pixel platformer about the last courier network in a shut-down city.",
    genres: ["Platformer", "Indie"],
    cover: cover7,
    hypeScore: 52,
    events: [
      {
        date: "2026-09-08T00:00:00Z",
        precision: "date",
        confidence: "confirmed",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "switch", "mobile"],
      },
    ],
  },
  {
    slug: "iron-vigil",
    title: "Iron Vigil",
    developer: "Redshift Works",
    publisher: "Meridian Games",
    summary: "Pilot salvaged mechs in a war nobody remembers starting.",
    genres: ["Mech", "Tactics"],
    cover: cover8,
    hypeScore: 77,
    events: [
      {
        date: "2026-09-12T00:00:00Z",
        precision: "date",
        confidence: "expected",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "xbox", "playstation"],
      },
    ],
  },
  {
    slug: "starfall-rangers",
    title: "Starfall Rangers",
    developer: "Bright Anvil",
    publisher: "Bright Anvil",
    summary: "Co-op sci-fi squad tactics with a persistent, breakable galaxy.",
    genres: ["Tactics", "Co-op"],
    cover: cover4,
    hypeScore: 70,
    events: [
      {
        date: "2026-09-18T00:00:00Z",
        precision: "date",
        confidence: "high",
        kind: "full",
        state: "delayed",
        platforms: ["pc", "steam", "xbox"],
        delayDays: 7,
        previousDate: "2026-09-11T00:00:00Z",
      },
    ],
  },
  {
    slug: "voidwake",
    title: "Voidwake",
    developer: "Nine Lantern",
    publisher: "Wanderpost",
    summary: "A horror roguelite where the ship map is redrawn by whatever is chasing you.",
    genres: ["Horror", "Roguelite"],
    cover: cover6,
    hypeScore: 65,
    events: [
      {
        date: "2026-09-22T00:00:00Z",
        precision: "date",
        confidence: "expected",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "playstation"],
        delayDays: -1,
        previousDate: "2026-09-23T00:00:00Z",
      },
    ],
  },
  {
    slug: "quiet-provinces",
    title: "Quiet Provinces",
    developer: "Longtable",
    publisher: "Longtable",
    summary: "A slow strategy game about governing a valley over four generations.",
    genres: ["Strategy"],
    cover: cover3,
    events: [
      {
        date: "2026-10-01T00:00:00Z",
        precision: "quarter",
        confidence: "expected",
        kind: "full",
        state: "upcoming",
        platforms: ["pc"],
      },
    ],
  },
  {
    slug: "last-signal",
    title: "Last Signal",
    developer: "Thin Air",
    publisher: "Thin Air",
    summary: "An unannounced-window narrative thriller told entirely through radio traffic.",
    genres: ["Narrative"],
    cover: cover7,
    events: [
      {
        date: "2027-01-01T00:00:00Z",
        precision: "tba",
        confidence: "tba",
        kind: "full",
        state: "upcoming",
        platforms: ["pc", "mobile"],
      },
    ],
  },
  {
    slug: "sable-oath",
    title: "Sable Oath",
    developer: "Blackreach",
    publisher: "Vantage Interactive",
    summary: "A stealth-forward fantasy campaign about debts that outlive their holders.",
    genres: ["Stealth", "RPG"],
    cover: cover5,
    criticScore: 88,
    events: [
      {
        date: "2026-08-21T00:00:00Z",
        precision: "date",
        confidence: "confirmed",
        kind: "full",
        state: "available",
        platforms: ["pc", "playstation", "xbox"],
      },
    ],
  },
  {
    slug: "glitchstorm-protocol",
    title: "Glitchstorm Protocol",
    developer: "Halfstep Games",
    publisher: "Halfstep Games",
    summary: "A fast extraction shooter where the map is actively corrupting.",
    genres: ["Shooter"],
    cover: cover1,
    criticScore: 81,
    events: [
      {
        date: "2026-07-15T00:00:00Z",
        precision: "date",
        confidence: "confirmed",
        kind: "full",
        state: "available",
        platforms: ["pc", "steam", "xbox"],
      },
    ],
  },
];

export const GAMES: Game[] = seeds.map((seed, gi) => {
  const id = `game-${gi + 1}`;
  return {
    id,
    slug: seed.slug,
    title: seed.title,
    ...(seed.originalTitle ? { originalTitle: seed.originalTitle } : {}),
    developer: seed.developer,
    publisher: seed.publisher,
    summary: seed.summary,
    genres: seed.genres,
    coverUrl: seed.cover,
    backdropUrl: heroBackdrop,
    platforms: Array.from(new Set(seed.events.flatMap((e) => e.platforms))),
    releaseEvents: seed.events.map((event, ei) => ({
      ...event,
      id: `${id}-rel-${ei + 1}`,
      gameId: id,
    })),
    ...(seed.hypeScore ? { hypeScore: seed.hypeScore } : {}),
    ...(seed.criticScore ? { criticScore: seed.criticScore } : {}),
  } satisfies Game;
});

export const GAMES_BY_ID = new Map(GAMES.map((g) => [g.id, g]));
export const GAMES_BY_SLUG = new Map(GAMES.map((g) => [g.slug, g]));

export function getGame(id: string) {
  return GAMES_BY_ID.get(id);
}

export const FEATURED_GAME = GAMES[0]!;
export const FEATURED_RELEASE = FEATURED_GAME.releaseEvents[0]!;

export interface RadarEntry {
  game: Game;
  event: ReleaseEvent;
}

/** Flat, date-sorted list of upcoming release events for the radar rail. */
export const UPCOMING_RELEASES: RadarEntry[] = GAMES.flatMap((game) =>
  game.releaseEvents
    .filter((event) => event.state !== "available")
    .map((event) => ({ game, event })),
).sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime());

export const RECENTLY_RELEASED: RadarEntry[] = GAMES.flatMap((game) =>
  game.releaseEvents.filter((e) => e.state === "available").map((event) => ({ game, event })),
).sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());

export const CHANGED_RELEASES: RadarEntry[] = UPCOMING_RELEASES.filter(
  (entry) => entry.event.previousDate,
);

export const DEALS: Deal[] = [
  {
    id: "deal-1",
    gameId: "game-14",
    store: "Steam",
    priceCurrent: 17.99,
    priceBase: 29.99,
    discountPercent: 40,
    currency: "USD",
    endsAt: "2026-09-09T00:00:00Z",
  },
  {
    id: "deal-2",
    gameId: "game-13",
    store: "PlayStation Store",
    priceCurrent: 14.99,
    priceBase: 19.99,
    discountPercent: 25,
    currency: "USD",
    endsAt: "2026-09-06T00:00:00Z",
  },
  {
    id: "deal-3",
    gameId: "game-5",
    store: "Epic Games Store",
    priceCurrent: 25.99,
    priceBase: 39.99,
    discountPercent: 35,
    currency: "USD",
  },
  {
    id: "deal-4",
    gameId: "game-7",
    store: "Nintendo eShop",
    priceCurrent: 9.99,
    priceBase: 19.99,
    discountPercent: 50,
    currency: "USD",
  },
  {
    id: "deal-5",
    gameId: "game-2",
    store: "Steam",
    priceCurrent: 34.99,
    priceBase: 59.99,
    discountPercent: 42,
    currency: "USD",
    endsAt: "2026-09-12T00:00:00Z",
  },
  {
    id: "deal-6",
    gameId: "game-9",
    store: "Xbox Store",
    priceCurrent: 11.24,
    priceBase: 44.99,
    discountPercent: 75,
    currency: "USD",
    endsAt: "2026-09-07T00:00:00Z",
  },
  {
    id: "deal-7",
    gameId: "game-11",
    store: "GOG",
    priceCurrent: 6.79,
    priceBase: 16.99,
    discountPercent: 60,
    currency: "USD",
  },
  {
    id: "deal-8",
    gameId: "game-3",
    store: "Humble Store",
    priceCurrent: 22.49,
    priceBase: 29.99,
    discountPercent: 25,
    currency: "USD",
    endsAt: "2026-09-20T00:00:00Z",
  },
];

export const GIVEAWAYS: Giveaway[] = [
  {
    id: "give-1",
    gameId: "game-7",
    store: "Epic Games Store",
    endsAt: "2026-09-10T15:00:00Z",
    worth: 19.99,
    currency: "USD",
  },
  {
    id: "give-2",
    gameId: "game-3",
    store: "GOG",
    endsAt: "2026-09-05T12:00:00Z",
    worth: 14.99,
    currency: "USD",
  },
  {
    id: "give-3",
    gameId: "game-11",
    store: "Prime Gaming",
    endsAt: "2026-09-16T23:59:00Z",
    worth: 24.99,
    currency: "USD",
  },
  {
    id: "give-4",
    gameId: "game-9",
    store: "Epic Games Store",
    endsAt: "2026-09-04T15:00:00Z",
    worth: 9.99,
    currency: "USD",
  },
];

export const ARTICLES: Article[] = [
  {
    id: "art-1",
    title: "Aetherfall: Eclipse locks its launch window and drops a 12-minute deep dive",
    source: "Vantage Newsroom",
    publishedAt: "2026-09-02T08:00:00Z",
    gameId: "game-1",
  },
  {
    id: "art-2",
    title: "Emberfall Crown slips a week, publisher cites console certification",
    source: "Release Wire",
    publishedAt: "2026-09-01T16:30:00Z",
    gameId: "game-5",
  },
  {
    id: "art-3",
    title: "Orbital Drift II opens early access with a hard-mode economy patch",
    source: "Station Log",
    publishedAt: "2026-08-31T11:15:00Z",
    gameId: "game-4",
  },
  {
    id: "art-4",
    title: "Switch 2 line-up quietly gains three indie ports this month",
    source: "Handheld Weekly",
    publishedAt: "2026-08-30T09:45:00Z",
  },
  {
    id: "art-5",
    title: "Ashen Vale Reborn confirms a same-day day-one patch and 60fps console modes",
    source: "Vantage Newsroom",
    publishedAt: "2026-08-29T13:20:00Z",
    gameId: "game-3",
  },
  {
    id: "art-6",
    title: "Publisher opens cross-save beta ahead of the autumn release wave",
    source: "Release Wire",
    publishedAt: "2026-08-28T07:05:00Z",
    gameId: "game-2",
  },
  {
    id: "art-7",
    title: "Storefront sale trackers flag the deepest discounts of the quarter",
    source: "Station Log",
    publishedAt: "2026-08-27T18:40:00Z",
  },
];

export const VIDEOS: Video[] = [
  {
    id: "vid-1",
    gameId: "game-1",
    title: "Aetherfall: Eclipse — Launch Trailer",
    kind: "trailer",
    thumbnailUrl: heroBackdrop,
    durationSeconds: 142,
  },
  {
    id: "vid-2",
    gameId: "game-1",
    title: "Aetherfall: Eclipse — 12 Minutes of Gameplay",
    kind: "gameplay",
    thumbnailUrl: heroBackdrop,
    durationSeconds: 733,
  },
];

export const LAUNCH_WAVE: RegionLaunch[] = [
  { region: "Los Angeles", timezoneLabel: "PDT", localTime: "Sep 9, 07:00 PM" },
  { region: "New York", timezoneLabel: "EDT", localTime: "Sep 9, 10:00 PM" },
  { region: "London", timezoneLabel: "BST", localTime: "Sep 10, 03:00 AM" },
  {
    region: "Ho Chi Minh City",
    timezoneLabel: "GMT+7",
    localTime: "Sep 10, 09:00 AM",
    isUserRegion: true,
  },
  { region: "Tokyo", timezoneLabel: "JST", localTime: "Sep 10, 11:00 AM" },
  { region: "Sydney", timezoneLabel: "AEST", localTime: "Sep 10, 12:00 PM" },
];

export const TRENDING: Game[] = [
  GAMES[0]!,
  GAMES[4]!,
  GAMES[3]!,
  GAMES[12]!,
  GAMES[13]!,
  GAMES[7]!,
];
