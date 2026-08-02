const CACHE_NAME = 'accessible-chess-v3';

// Static assets to pre-cache on PWA installation
const PRECACHE_ASSETS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600;700&display=swap'
];

// Install Event - Pre-cache essential resources cleanly
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Promise.allSettled ensures installation succeeds even if a external font fails
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up previous cache versions immediately
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

// Fetch Event - Dynamic Cache-First Strategy for Offline Capability
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // Bypass cache for online APIs (Stockfish bot, Firebase/Firestore)
  if (
    requestUrl.includes('stockfish.online') ||
    requestUrl.includes('firestore.googleapis.com') ||
    requestUrl.includes('firebase')
  ) {
    return;
  }

  // Handle navigation requests (main HTML loading)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cachedHtml) => {
        return (
          cachedHtml ||
          fetch(event.request).catch(() => caches.match('./index.html'))
        );
      })
    );
    return;
  }

  // Cache-First with Fallback to Network for all standard assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type === 'opaque'
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Silent catch for offline missing resources
        });
    })
  );
});
