/* Minimal service worker: makes the app installable and keeps the
   app shell reachable even with a flaky connection. It does not try
   to cache Supabase API calls or the Google Fonts / Supabase CDN
   scripts — those still need network, exactly like today.

   Strategy: network-first, cache as a fallback only. Whenever the
   device is online, you always get the latest deployed version —
   the cache exists purely so the app still opens if you're offline.
   (An earlier "cache-first" version could keep showing old content
   indefinitely on an installed app that's resumed from the
   background rather than fully reloaded — this fixes that.) */
const CACHE_NAME = "personality-mindmap-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase / CDN / font requests
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
