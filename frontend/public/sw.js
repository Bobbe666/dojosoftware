// =====================================================================================
// SERVICE WORKER - Dojosoftware
// Push-Notifications + Chat-Benachrichtigungen
// Version: CHAT_2026_03_01
// =====================================================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Kein Caching - alle Requests direkt ans Netzwerk
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => new Response('Offline', { status: 503 }))
  );
});

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
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    data: data.data || { url: '/member/chat' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: data.tag || 'dojo-notification'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
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
