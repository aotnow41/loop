/* RC-505mkII Loop Station — service worker
   Cache-first for static shell + network fallback. */

const CACHE = 'rc505-v1';
const SHELL = [
  './',
  './RC-505mkII Loop Station.html',
  './rc505.css',
  './rc505.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.png',
  // External (cache opaquely)
  'https://unpkg.com/tone@14.8.49/build/Tone.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=VT323&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { mode: 'no-cors' }))))
      .catch(err => console.warn('[sw] precache partial fail', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => {
      if(hit) return hit;
      return fetch(req).then(res => {
        // Don't cache opaque/redirect responses except for our static shell
        const copy = res.clone();
        if(res.ok || res.type === 'opaque'){
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => {
        // offline fallback — return the main page if asking for HTML
        if(req.headers.get('accept')?.includes('text/html')){
          return caches.match('./RC-505mkII Loop Station.html');
        }
      });
    })
  );
});
