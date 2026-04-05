// ADN Capital — Service Worker v2 (fixed caching strategy)
const CACHE_NAME = 'adn-capital-v2';
const STATIC_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/logo.jpg',
];

// Install — pre-cache only images, NOT pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls → network only (never cache)
// - Next.js JS/CSS bundles → network first, NO cache fallback
// - Images/fonts → cache first
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls — always go to network, never cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Next.js JS/CSS bundles and HTML pages — ALWAYS network (no cache)
  // This prevents stale JS from being served
  if (
    url.pathname.startsWith('/_next/') ||
    request.mode === 'navigate' ||
    request.destination === 'document'
  ) {
    return;
  }

  // Static assets (images, fonts) — cache first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }).catch(() => fetch(request))
    );
    return;
  }

  // Everything else — network only
});
