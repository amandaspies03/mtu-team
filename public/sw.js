// Keeps a copy of the app on the device so it opens with no signal (registered in app/app-shell.tsx).
// - The page: network first (8 s), falls back to the saved copy.
// - App code (/_next/static, fingerprinted): saved the first time it loads.
// - Match day pictures, icons, manifest: saved at install, refreshed in the background.
// Never touches /api or the database (those go straight to the network; the app has its own offline copy).
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const SHELL = `mtu-shell-${VERSION}`;
const CODE = `mtu-code-${VERSION}`;
const PRECACHE = [
  '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/match/scorecard-pi2210.png', '/match/scorecard-pi2250.png', '/match/scorecard-ri3020.png',
  '/match/scorecard-rifle-eic.png', '/match/target-rifle-eic.png',
  '/drills/dot-torture-target.png', '/drills/dot-torture-target.pdf',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => undefined)));
    try {
      const page = await fetch('/', { cache: 'reload', credentials: 'same-origin' });
      if (page.ok) {
        await cache.put('/', page.clone());
        await saveCodeFor(await page.text());
      }
    } catch { /* offline install */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, CODE]);
    for (const k of await caches.keys()) if (k.startsWith('mtu-') && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Save every app code file the page uses, so it all works offline even on the very first visit.
async function saveCodeFor(html) {
  const urls = [...new Set((html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []).map(u => u.replace(/&amp;/g, '&')))];
  const code = await caches.open(CODE);
  await Promise.all(urls.map(async u => { if (!(await code.match(u))) await code.add(u).catch(() => undefined); }));
}

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // The app page. All screens are '#...' views of '/', so one saved copy covers them.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await Promise.race([fetch(req), timeout(8000)]);
        if (res.ok && url.pathname === '/') {
          cache.put('/', res.clone()).catch(() => {});
          const copy = res.clone();
          event.waitUntil(copy.text().then(saveCodeFor).catch(() => {}));
        }
        return res;
      } catch {
        return (await cache.match('/')) || new Response('<!doctype html><title>Offline</title><p style="font:16px system-ui;padding:24px">No signal, and the team app hasn’t been saved on this device yet. Open it once with signal.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Fingerprinted app code never changes: keep the first copy.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CODE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })());
    return;
  }

  // Pictures, icons, manifest: answer from the saved copy, refresh it in the background.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(url.pathname);
      const fresh = fetch(req).then(res => { if (res.ok) cache.put(url.pathname, res.clone()).catch(() => {}); return res; }).catch(() => undefined);
      return hit || (await fresh) || Response.error();
    })());
  }
});
