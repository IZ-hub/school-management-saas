// School Precise service worker. It makes the site installable and shows a friendly page when
// there's no internet. It deliberately caches nothing else: every page and every API call always
// comes fresh from the network, so a new release reaches everyone at once and no school ever
// sees stale records.
const OFFLINE = 'school-precise-offline-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE).then((cache) => cache.addAll([OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only page loads get the offline fallback; everything else goes straight to the network untouched.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
