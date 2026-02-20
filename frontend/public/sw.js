// Final Cleanup Service Worker
// Dieser Service Worker löscht ALLE Caches und deregistriert sich dann selbst
// Version: FINAL_CLEANUP_2026_02_20

console.log('[SW CLEANUP] Starting final cleanup service worker');

self.addEventListener('install', (event) => {
  console.log('[SW CLEANUP] Installing cleanup worker');
  // Sofort aktivieren ohne auf andere Tabs zu warten
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW CLEANUP] Activating cleanup worker');

  event.waitUntil(
    (async () => {
      try {
        // 1. Alle Cache-Storage löschen
        console.log('[SW CLEANUP] Deleting all caches...');
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW CLEANUP] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        console.log('[SW CLEANUP] All caches deleted:', cacheNames.length);

        // 2. Alle Clients übernehmen
        await self.clients.claim();
        console.log('[SW CLEANUP] Claimed all clients');

        // 3. Alle Clients benachrichtigen
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_CLEANUP_COMPLETE',
            message: 'Service Worker wurde deaktiviert. Bitte laden Sie die Seite neu.'
          });
        });

        // 4. Service Worker selbst deregistrieren
        const registration = await self.registration;
        const unregistered = await registration.unregister();

        if (unregistered) {
          console.log('[SW CLEANUP] ✓ Service Worker successfully unregistered');
        } else {
          console.log('[SW CLEANUP] ⚠️ Service Worker unregister failed');
        }

      } catch (error) {
        console.error('[SW CLEANUP] Error during cleanup:', error);
      }
    })()
  );
});

// Kein Caching - alles direkt vom Netzwerk
self.addEventListener('fetch', (event) => {
  // Einfach die normale Netzwerk-Anfrage durchreichen
  event.respondWith(fetch(event.request));
});

console.log('[SW CLEANUP] Cleanup service worker loaded');
