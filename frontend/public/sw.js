/* MineCAD AI — minimal hand-rolled service worker (no workbox)
 * Strategy map:
 *  - same-origin static assets (/_next/static, icons, favicon): cache-first, network fallback
 *  - document navigations: network-first, cache fallback (fast offline shell)
 *  - /api/* and cross-origin: pass through, NEVER cached
 */

const VERSION = 'minecad-v1';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
];

const STATIC_PREFIXES = ['/_next/static/', '/icons/'];
const STATIC_EXACT = ['/favicon.ico', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API and cross-origin requests: pass through untouched, never cached
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Document navigations: network-first with cached shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put('/', copy));
          }
          return res;
        })
        .catch(() =>
          caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // Static assets: cache-first, then network (and populate the cache)
  const isStatic =
    STATIC_EXACT.includes(url.pathname) ||
    STATIC_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});
