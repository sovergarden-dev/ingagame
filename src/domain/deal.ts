/** Milliseconds of `endsAt`, or null when the deal has no usable expiry. */
export function parseDealEndMs(endsAt: string | undefined): number | null {
  if (!endsAt) return null;
  const ms = Date.parse(endsAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Shared expiry clock for toasts, deal cards, and free-game lists.
 * Unknown clock (`now === null`) and missing/invalid `endsAt` are not expired.
 */
export function hasEnded(endsAt: string | undefined, now: number | null): boolean {
  if (now === null) return false;
  const ms = parseDealEndMs(endsAt);
  if (ms === null) return false;
  return ms <= now;
}

export const isDealExpired = hasEnded;

export const ENDING_SOON_MS = 72 * 3_600_000;

/** Still active and within the ending-soon window. Expired items never qualify. */
export function isEndingSoon(
  endsAt: string | undefined,
  now: number | null,
  windowMs = ENDING_SOON_MS,
): boolean {
  if (now === null || hasEnded(endsAt, now)) return false;
  const ms = parseDealEndMs(endsAt);
  if (ms === null) return false;
  return ms - now < windowMs;
}
