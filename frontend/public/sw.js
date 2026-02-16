const CACHE_NAME = 'boma-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/manifest.json',
];
const API_CACHE = 'boma-api-cache-v1';
const OFFLINE_QUEUE_KEY = 'boma-offline-queue';

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy: Network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const clone = response.clone();
            // Cache today, lessons, chores, children data
            if (
              url.pathname.includes('/curriculum/today') ||
              url.pathname.includes('/curriculum/lessons') ||
              url.pathname.includes('/chores/instances') ||
              url.pathname.includes('/children') ||
              url.pathname.includes('/streaks')
            ) {
              caches.open(API_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match(request))
      );
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      // Mutating requests: try network, queue if offline
      event.respondWith(
        fetch(request).catch(async () => {
          // Queue for later sync
          const body = await request.clone().text();
          const queueItem = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body,
            timestamp: Date.now(),
          };
          // Store in IndexedDB or broadcast to client
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({ type: 'QUEUE_OFFLINE_ACTION', payload: queueItem });
          });
          return new Response(JSON.stringify({ status: 'queued', message: 'Action queued for sync' }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );
    }
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Return offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync for queued writes
self.addEventListener('sync', (event) => {
  if (event.tag === 'boma-sync') {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  // Notify clients to replay their queued actions
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'REPLAY_OFFLINE_QUEUE' });
  });
}

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
