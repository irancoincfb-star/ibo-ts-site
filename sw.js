/* ==========================================================================
   IBO-TS Progressive Web App (PWA) Service Worker
   Offline caching, background sync, and trading signal push notifications
   ========================================================================== */

const CACHE_NAME = 'ibots-pwa-v2.6.5';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/purchase.js',
  '/static/js/template.js',
  '/static/assets/ibots_logo_transparent.png',
  '/static/assets/icons/icon-192.png',
  '/static/assets/icons/icon-512.png',
  '/static/assets/icons/favicon.png'
];

// Install: Cache critical shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache prefetch warning:', err);
      });
    })
  );
});

// Activate: Clean up old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic API and websocket endpoints, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass cache for API endpoints, WebSocket, and APK downloads
  if (
    requestUrl.pathname.startsWith('/api/') ||
    requestUrl.pathname.startsWith('/ws/') ||
    requestUrl.pathname.startsWith('/download/') ||
    event.request.method !== 'GET'
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Network unavailable. Running in offline mode.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Navigation requests: NETWORK FIRST — never serve a stale cached page
  // (fallback to cache only when truly offline). Ensures updates land on 1st open.
  if (event.request.mode === 'navigate' || requestUrl.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Stale-while-revalidate for static files
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push: Display rich instant alerts for trading signals & countdown warnings
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 سیگنال معاملاتی جدید IBO-TS',
    body: 'موقعیت ورود تاییدشده جدید در پلتفرم ثبت شد.',
    icon: '/static/assets/icons/icon-192.png',
    badge: '/static/assets/icons/favicon.png',
    url: '/#signals'
  };

  try {
    if (event.data) {
      data = Object.assign(data, event.data.json());
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  // Per-market notification icon: use the official logo of the signal's
  // symbol from the daily-synced symbol library, else the app icon.
  if (!data.icon && data.symbol) {
    let b = String(data.symbol).toUpperCase();
    for (const q of ['USDT', 'USDC', 'USD', 'BUSD']) {
      if (b.endsWith(q) && b.length > q.length) { b = b.slice(0, -q.length); break; }
    }
    b = b.replace(/[^A-Z0-9]/g, '').toLowerCase();
    if (b) data.icon = '/static/assets/symbols/' + b + '.png';
  }

  const options = {
    body: data.body,
    icon: data.icon || '/static/assets/icons/icon-192.png',
    badge: data.badge || '/static/assets/icons/favicon.png',
    vibrate: [200, 100, 200, 100, 300],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'مشاهده جزئیات' },
      { action: 'dismiss', title: 'بستن' }
    ],
    dir: 'rtl',
    lang: 'fa-IR',
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification Click: Navigate user to app and focus window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
