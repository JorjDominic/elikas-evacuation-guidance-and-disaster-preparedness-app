/* eslint-disable no-restricted-globals */
/**
 * eLikas PWA Service Worker
 * Processed by CRA's workbox-webpack-plugin (InjectManifest) at build time.
 * workbox-* imports are resolved by react-scripts – no extra install needed.
 */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  precacheAndRoute,
  createHandlerBoundToURL,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

// Take control of all clients immediately on activation
clientsClaim();

// Inject the build-time precache manifest (filled in by CRA's build step)
precacheAndRoute(self.__WB_MANIFEST);

// ── Navigation fallback ──────────────────────────────────────────────────────
// All same-origin navigation requests serve index.html (SPA shell).
const fileExtensionRegexp = /[^/?]+\.[^/]+$/;
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// ── Google Fonts – stale-while-revalidate ───────────────────────────────────
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'elikas-google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// ── App images – cache-first with expiration ────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'elikas-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ── Leaflet tiles – stale-while-revalidate ──────────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname === 'tile.openstreetmap.org' ||
    url.hostname.endsWith('.tile.openstreetmap.org'),
  new StaleWhileRevalidate({
    cacheName: 'elikas-map-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ── SKIP_WAITING message from registration helper ───────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Open-Meteo weather API – stale-while-revalidate, 10-min TTL ─────────────
registerRoute(
  ({ url }) => url.hostname === 'api.open-meteo.com',
  new StaleWhileRevalidate({
    cacheName: 'elikas-weather',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 10 }),
    ],
  })
);

// ── Nominatim reverse geocode – cache-first, 24h TTL ────────────────────────
// Geocode results are stable for the same coordinates, so cache-first is safe.
registerRoute(
  ({ url }) => url.hostname === 'nominatim.openstreetmap.org',
  new CacheFirst({
    cacheName: 'elikas-geocode',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
);

// ── Web Push push event handler ──────────────────────────────────────────────
// Displays incoming push payloads as OS notifications even when the tab is closed.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'eLikas', body: event.data.text() }; }

  const title = payload.title || 'eLikas Alert';
  const options = {
    body: payload.body || '',
    icon: '/elikas icon transparent.png',
    badge: '/elikas icon transparent.png',
    tag: payload.tag || 'elikas-alert',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: focus or open the app ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
