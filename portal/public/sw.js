/* global self, caches */
// Stamply portal service worker. Keeps the last copy of the card pages so a
// customer standing at the counter with a weak signal still sees their card
// and reward codes. Everything else goes straight to the network.
const PAGES = "ttp-pages-v1";
const ASSETS = "ttp-assets-v1";
const OFFLINE_PATHS = /^\/(cards|rewards)(\/|$)/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Signing out or deleting the account clears what was kept on this phone.
self.addEventListener("message", (event) => {
  if (event.data === "clear") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(ASSETS)]));
  }
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title></head>
<body style="font-family:system-ui;padding:2rem;text-align:center;color:#334155">
<p style="font-size:1.25rem;font-weight:600">You are offline</p>
<p>Open your card once while connected and it will be here next time.</p></body></html>`;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Built files never change under the same name: keep them once seen.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Card pages: always fresh when online, the last copy when not.
  if (request.mode === "navigate" && OFFLINE_PATHS.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const hit = await caches.match(request, { ignoreSearch: true });
          return (
            hit ??
            new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
          );
        }),
    );
  }
});
