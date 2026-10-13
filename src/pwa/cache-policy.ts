export type CacheDecision = "network-only" | "network-first" | "cache-first";

/** How a request may be stored. Catalogue and other origins are never cached here. */
export function cacheDecision(
  url: URL,
  request: { method: string; mode: string },
  origin: string,
): CacheDecision {
  if (request.method !== "GET") return "network-only";
  if (url.origin !== origin) return "network-only";
  if (url.pathname.includes("/functions/") || url.pathname.includes("content-feed"))
    return "network-only";
  if (request.mode === "navigate") return "network-first";
  if (url.pathname.startsWith("/assets/")) return "cache-first";
  return "network-only";
}
