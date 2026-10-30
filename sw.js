// Service Worker para PWA (iOS Safari / Android Chrome)
const CACHE_NAME = 'arena-blockout-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa versões antigas do cache para não acumular lixo no navegador
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Normaliza requisições para remover timestamps transientes (?_t=...) evitando vazamento de cache
function getNormalizedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.searchParams.has('_t')) {
      u.searchParams.delete('_t');
      return u.toString();
    }
  } catch {}
  return urlStr;
}

self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET (POST, PUT) ou de esquemas não suportados como chrome-extension://
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const normalizedUrl = getNormalizedUrl(event.request.url);

  // Estratégia Network-First com fallback seguro para Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a resposta for válida, opcionalmente clona e guarda no cache usando a URL normalizada
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(normalizedUrl, responseToCache);
          }).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        // Busca com ignoreSearch: true para encontrar mapas mesmo com parâmetros de busca
        const cachedResponse = await caches.match(normalizedUrl, { ignoreSearch: true });
        if (cachedResponse) {
          return cachedResponse;
        }
        // Se falhar na rede e não existir no cache, retorna uma resposta vazia ou erro controlado
        return new Response('Offline: Recurso indisponível', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      })
  );
});
