/** Milliseconds of `endsAt`, or null when the deal has no usable expiry. */
export function parseDealEndMs(endsAt: string | undefined): number | null {
  if (!endsAt) return null;
  const ms = Date.parse(endsAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Shared expiry clock for toasts and deal cards.
 * Unknown clock (`now === null`) and missing/invalid `endsAt` are not expired.
 */
export function isDealExpired(endsAt: string | undefined, now: number | null): boolean {
  if (now === null) return false;
  const ms = parseDealEndMs(endsAt);
  if (ms === null) return false;
  return ms <= now;
}
