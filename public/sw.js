const CACHE = "medicool-v2";
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const HOME = `${BASE}/`;
const MANIFEST = `${BASE}/manifest.webmanifest`;
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([HOME, MANIFEST]))));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(response => response || caches.match(HOME))));
});
