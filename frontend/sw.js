/**
 * Niche Collector Connector Service Worker
 * Enables offline support and caching
 */

const CACHE_NAME = 'niche-collector-v59';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/profile.html',
  '/style.css',
  '/js/config.js',
  '/js/auth.js',
  '/js/profile.js',
  '/js/forums.js',
  '/js/interests.js',
  '/js/templates/index.js',
  '/css/auth.css',
  '/css/profile.css',
  '/css/forums.css'
];

// External resources to cache
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@500&family=Montserrat:wght@300;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache static assets (ignore failures for individual files)
      return Promise.allSettled(
        [...STATIC_ASSETS, ...EXTERNAL_ASSETS].map(url =>
          cache.add(url).catch(err => console.log(`Failed to cache: ${url}`))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests (always fetch from network)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip navigation requests for Safari compatibility
  // Safari doesn't allow service workers to return redirected responses
  if (event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Don't return redirected responses (Safari fix)
      if (cachedResponse && !cachedResponse.redirected) {
        // Return cached response, but also update cache in background
        event.waitUntil(
          fetch(event.request).then((response) => {
            if (response.ok && !response.redirected) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // Not in cache - fetch from network
      return fetch(event.request).then((response) => {
        // Cache successful non-redirected responses
        if (response.ok && response.type === 'basic' && !response.redirected) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/profile.html');
        }
      });
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
