// =====================================================================================
// SERVICE WORKER - Dojosoftware
// Push-Notifications + Chat-Benachrichtigungen + App-Badge
// Version: 2026_03_30
// =====================================================================================

// Merkt sich, ob beim Installieren bereits ein alter SW aktiv war (= echtes Update)
let istUpdate = false;
self.addEventListener('install', (event) => {
  istUpdate = !!self.registration.active;
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Alle alten Caches (z.B. von früherer PWA/Workbox) löschen
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await clients.claim();

      // Nur bei echtem Update (nicht beim Erst-Install): offene Fenster einmal neu laden,
      // damit die neue App-Version (frische Assets) sofort greift. Durchbricht hartnäckige
      // Home-Screen-PWA-Caches ohne Neuinstallation.
      if (istUpdate) {
        try {
          const wins = await clients.matchAll({ type: 'window' });
          for (const win of wins) {
            if (win.url) win.navigate(win.url);
          }
        } catch (_) { /* navigate optional */ }
      }
    })()
  );
});

// Kein fetch-Handler → kein Request-Interception, kein Caching, keine Update-Probleme

// ─── Push-Notifications empfangen ─────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'Dojosoftware',
      body: event.data ? event.data.text() : 'Neue Nachricht'
    };
  }

  const title = data.title || 'Dojosoftware';
  const options = {
    body: data.body || data.message || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: data.data || { url: '/member/chat' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'dojo-notification',
    renotify: true
  };

  // App-Badge setzen (unreadCount aus Payload oder +1)
  const setBadge = () => {
    if ('setAppBadge' in self.navigator) {
      const count = typeof data.unreadCount === 'number' ? data.unreadCount : undefined;
      return count != null
        ? self.navigator.setAppBadge(count)
        : self.navigator.setAppBadge();
    }
    return Promise.resolve();
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      setBadge()
    ])
  );
});

// ─── Notification-Klick: App öffnen oder fokussieren ─────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/member/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Badge beim Klick löschen
      if ('clearAppBadge' in self.navigator) {
        self.navigator.clearAppBadge().catch(() => {});
      }
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Badge-Update aus App (via postMessage) ───────────────────────────────────

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SET_BADGE' && 'setAppBadge' in self.navigator) {
    const count = event.data.count;
    (count > 0
      ? self.navigator.setAppBadge(count)
      : self.navigator.clearAppBadge()
    ).catch(() => {});
  }
});
