/**
 * eLikas Service Worker Registration
 * Registers the production service worker, handles update prompts,
 * and provides an `unregister()` helper for development rollback.
 */

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/)
);

/** Call this in index.js to enable offline-first behaviour in production. */
export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);

    // Service worker won't work if PUBLIC_URL is on a different origin.
    if (publicUrl.origin !== window.location.origin) return;

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // On localhost, verify that a service worker still exists.
        checkValidServiceWorker(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.info('[eLikas SW] Running in offline-first mode.');
        });
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      // Poll for updates every hour
      setInterval(() => registration.update(), 60 * 60 * 1000);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available; notify the app.
              console.info('[eLikas SW] New content available – will reload on next visit.');
              if (config && config.onUpdate) config.onUpdate(registration);

              // Auto-activate after a short grace period
              setTimeout(() => {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }, 4000);
            } else {
              // First install – content is now cached.
              console.info('[eLikas SW] Content cached for offline use.');
              if (config && config.onSuccess) config.onSuccess(registration);
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('[eLikas SW] Registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && !contentType.includes('javascript'))
      ) {
        // SW not found – unregister and reload.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => window.location.reload());
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.info('[eLikas SW] No internet connection – app running in offline mode.');
    });
}

/** Call to remove the service worker (useful for debugging). */
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error.message));
  }
}
