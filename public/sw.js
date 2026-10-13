const CACHE = "inga-shell-v1";

function decision(url, request) {
  if (request.method !== "GET") return "network-only";
  if (url.origin !== self.location.origin) return "network-only";
  if (url.pathname.includes("/functions/") || url.pathname.includes("content-feed"))
    return "network-only";
  if (request.mode === "navigate") return "network-first";
  if (url.pathname.startsWith("/assets/")) return "cache-first";
  return "network-only";
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const choice = decision(url, event.request);
  if (choice === "network-only") return;
  if (choice === "network-first") {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }),
  );
});
