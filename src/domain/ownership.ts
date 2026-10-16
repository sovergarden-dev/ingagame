import type { Game } from "./types";

/**
 * Steam AppID must be a positive unsigned 32-bit integer.
 * 0 is invalid/sentinel. Negative, non-integer, and > 0xFFFFFFFF are rejected.
 */
export function isValidSteamAppId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 0xffffffff;
}

/**
 * Resolves the Steam AppID from either a Game object or canonical catalogue ID.
 * Never parses strings directly as numeric AppIDs (avoids ambiguous ID collisions).
 */
export function resolveGameSteamAppId(
  gameOrId: Game | string,
  catalogueResolver?: (id: string) => Game | undefined,
): number | undefined {
  if (typeof gameOrId === "object" && gameOrId !== null) {
    return isValidSteamAppId(gameOrId.steamAppId) ? gameOrId.steamAppId : undefined;
  }
  if (typeof gameOrId === "string" && catalogueResolver) {
    const game = catalogueResolver(gameOrId);
    if (game && isValidSteamAppId(game.steamAppId)) {
      return game.steamAppId;
    }
  }
  return undefined;
}

export type OwnershipStatus = "owned" | "not_owned" | "unknown";

export interface OwnershipStateParams {
  connected: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "unavailable" | "failed";
  ownedAppIdsSet: ReadonlySet<number> | null;
  steamAppId?: number | undefined;
  mockOwnedGameIds?: string[] | undefined;
  gameId?: string | undefined;
}

/**
 * Computes deterministic tri-state ownership.
 *
 * Rules:
 * - If not connected to Steam: always "unknown".
 * - If mock session has gameId in mock list: "owned".
 * - If game has no valid steamAppId: always "unknown" (never false-negative "not_owned").
 * - If steamAppId is in ownedAppIdsSet: "owned".
 * - If syncStatus is "synced" and steamAppId is absent: "not_owned".
 * - If syncStatus is "unavailable", "failed", "idle", or "syncing" (and not found in prior cache): "unknown".
 */
export function getOwnershipStatus(params: OwnershipStateParams): OwnershipStatus {
  if (!params.connected) {
    return "unknown";
  }

  // Mock compatibility
  if (params.mockOwnedGameIds && params.gameId && params.mockOwnedGameIds.includes(params.gameId)) {
    return "owned";
  }

  if (!isValidSteamAppId(params.steamAppId)) {
    return "unknown";
  }

  // Unavailable or failed sync cannot certify current ownership -> unknown
  if (params.syncStatus === "unavailable" || params.syncStatus === "failed") {
    return "unknown";
  }

  if (params.syncStatus === "idle" && params.ownedAppIdsSet === null) {
    return "unknown";
  }

  if (params.ownedAppIdsSet && params.ownedAppIdsSet.has(params.steamAppId)) {
    return "owned";
  }

  if (params.syncStatus === "synced" && params.ownedAppIdsSet !== null) {
    return "not_owned";
  }

  return "unknown";
}

/**
 * Evaluates whether a game should be hidden by the "Hide owned" filter.
 * Strictly hides only when hideOwned is true AND ownership is confirmed "owned".
 * Games with status "unknown" or "not_owned" are never hidden.
 */
export function shouldHideOwnedGame(
  game: Game,
  hideOwned: boolean,
  getOwnership: (g: Game) => OwnershipStatus,
): boolean {
  if (!hideOwned) return false;
  return getOwnership(game) === "owned";
}
