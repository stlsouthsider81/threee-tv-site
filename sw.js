// Minimal service worker: exists so the site is installable as a PWA.
// No caching on purpose — this is a live stream site, so every request
// (playlists, segments, pages) should always hit the network.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function () {
  // Intentionally empty: default network handling for all requests.
});
