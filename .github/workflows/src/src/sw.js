// sw.js
const VERSION = 'v3';
const CACHE_STATIC = `nepse-static-${VERSION}`;
const CACHE_DYNAMIC = `nepse-dynamic-${VERSION}`;
const CACHE_API = `nepse-api-${VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/data/10y-finance.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install – precache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_STATIC && key !== CACHE_DYNAMIC && key !== CACHE_API)
          .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch – network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (isApi) {
    // Network-first, fallback to cache (then dynamic offline backup)
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_API).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for static
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_DYNAMIC).then(cache => cache.put(event.request, clone));
        return response;
      }))
    );
  }
});

// Optional: Background Sync for offline broadcasts
self.addEventListener('sync', event => {
  if (event.tag === 'broadcast') {
    event.waitUntil(
      fetch('/api/broadcast', { method: 'POST', body: JSON.stringify({ offline: true }) })
    );
  }
});
