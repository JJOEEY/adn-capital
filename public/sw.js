// ADN Capital - Service Worker v4 (with Web Push support)
const CACHE_NAME = 'adn-capital-v4';
const STATIC_ASSETS = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/logo.jpg',
  '/brand/favicon.png',
  '/brand/logo-dark.jpg',
  '/brand/logo-light.jpg',
];

// Install - pre-cache only images, NOT pages.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - delete all old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Allow the app shell to activate a freshly deployed worker immediately.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push event - receive notification from server.
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

// Click notification - open app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/notifications?tab=updates';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Fetch strategy:
// - API calls -> network only (never cache)
// - Next.js JS/CSS bundles -> network only
// - HTML documents -> network only
// - Images/fonts -> cache first
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (
    url.pathname.startsWith('/_next/') ||
    request.mode === 'navigate' ||
    request.destination === 'document'
  ) {
    return;
  }

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
  }
});
