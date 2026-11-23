/* HelmetAR service worker: caches the app shell, hero image, hashed build files, MediaPipe runtime and fonts.
 * (Helmet models and the face-tracker model are cached by the app itself via Cache Storage, see src/lib/assetCache.js.)
 * Bump VERSION to clear old caches. */
const VERSION = 'v1';
const CACHE = `helmetar-static-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('helmetar-static-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const cacheFirst = async (req) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
};

const staleWhileRevalidate = async (req) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || update;
};

const networkFirst = async (req) => {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('/index.html', res.clone());
    return res;
  } catch {
    return (await cache.match('/index.html')) || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return; // let video/range requests go straight through
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (req.mode === 'navigate') return event.respondWith(networkFirst(req));
    if (url.pathname.startsWith('/models/') || url.pathname.endsWith('.mp4')) return; // handled elsewhere / not cached here
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/mediapipe/') || url.pathname === '/helmet-hero.png') {
      return event.respondWith(cacheFirst(req));
    }
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
  }
});
