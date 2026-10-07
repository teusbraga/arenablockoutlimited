// Service Worker para PWA (iOS Safari / Android Chrome)
const CACHE_NAME = 'arena-blockout-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET (POST, PUT) ou de esquemas não suportados como chrome-extension://
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Estratégia Network-First com fallback seguro para Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a resposta for válida, opcionalmente clona e guarda no cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Se falhar na rede e não existir no cache, retorna uma resposta vazia ou erro controlado em vez de undefined
        return new Response('Offline: Recurso indisponível', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      })
  );
});
