// Vision AI - Service Worker DISABLED (cache was causing issues)
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});
// No caching - always fetch fresh
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
