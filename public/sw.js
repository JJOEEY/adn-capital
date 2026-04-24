// ADN Capital — Service Worker v3 (with Web Push support)
const CACHE_NAME = 'adn-capital-v3';
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

// Push event — nhận notification từ server
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'adn-notification',
      renotify: true,
      data: { url: data.url || '/notifications?tab=updates' },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'ADN Capital', options)
    );
  } catch (e) {
    console.error('[SW] Push parse error:', e);
  }
});

// Click notification — mở app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/notifications?tab=updates';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url);
    })
  );
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
