// Service Worker para PWA (iOS Safari / Android Chrome)
const CACHE_NAME = 'arena-blockout-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Estratégia Network-First com fallback para Cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
