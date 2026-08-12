/* Mamma Mia Truck — service worker.

   Job: make the app open instantly and keep working with no signal.
   Deliberately NOT in charge of the truck's data — that's handled in the page
   itself (localStorage first, then a merge-sync to Apps Script). This only
   caches the files that make up the app.

   Bump CACHE_NAME whenever you upload a new index.html so old copies get
   thrown away rather than lingering on someone's phone. */
const CACHE_NAME = 'mamma-mia-v4';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      // Individual addAll failures (a renamed icon, say) shouldn't block the
      // whole install and leave the app uncached.
      .then((cache) => Promise.all(APP_SHELL.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first for our own files so a fresh upload reaches phones on the next
   load, with the cache as the fallback when there's no signal. Cross-origin
   requests (the Apps Script sync, Drive photos) pass straight through — they
   must never be served from a stale cache. */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
          return res;
        }
        // Not an OK response. On the truck's wifi this is usually a captive
        // portal redirecting us — serving that would replace the app with a
        // "sign in to continue" page. Prefer the cached copy when we have one.
        return caches.match(e.request).then((cached) => cached || res);
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});
