/**
 * Mock Steam provider.
 *
 * DEV-only. Production must use the server-backed adapter (`client.ts`).
 * Shape mirrors the public snapshot so Settings can switch without new fields.
 */
import { GAMES } from "@/domain/mock-data";
import { SteamConnectError } from "./client";

export { SteamConnectError };

export interface SteamProfile {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  countryCode: string;
}

export interface SteamOwnedGame {
  gameId: string;
  playtimeMinutes: number;
  lastPlayedAt?: string;
}

export interface SteamLibrarySnapshot {
  profile: SteamProfile;
  ownedGames: SteamOwnedGame[];
  wishlistGameIds: string[];
  syncedAt: string;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic fake library so repeated connects look stable. */
function buildSnapshot(handle: string): SteamLibrarySnapshot {
  const seed = hashString(handle.toLowerCase());
  const owned = GAMES.filter((_, i) => (seed >> i) % 3 !== 0).slice(0, 6);
  const now = Date.now();

  return {
    profile: {
      steamId: `7656119${(seed % 1_000_000_000).toString().padStart(10, "0")}`,
      personaName: handle,
      avatarUrl: GAMES[seed % GAMES.length]!.coverUrl,
      profileUrl: `https://steamcommunity.com/id/${encodeURIComponent(handle)}`,
      countryCode: "VN",
    },
    ownedGames: owned.map((game, i) => ({
      gameId: game.id,
      playtimeMinutes: ((seed >> (i + 2)) % 240) * 7 + 45,
      lastPlayedAt: new Date(now - (i + 1) * 36 * 60 * 60 * 1000).toISOString(),
    })),
    wishlistGameIds: GAMES.filter((_, i) => (seed >> (i + 1)) % 4 === 0)
      .slice(0, 4)
      .map((g) => g.id),
    syncedAt: new Date(now).toISOString(),
  };
}

/** Simulated network round-trip against Steam. */
export async function fetchSteamLibrary(handle: string): Promise<SteamLibrarySnapshot> {
  const trimmed = handle.trim();
  await new Promise((resolve) => setTimeout(resolve, 900));

  if (trimmed.length < 3) {
    throw new SteamConnectError("handle-too-short");
  }
  if (trimmed.toLowerCase() === "private") {
    throw new SteamConnectError("profile-private");
  }
  return buildSnapshot(trimmed);
}
