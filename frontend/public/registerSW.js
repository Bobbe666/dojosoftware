// Service Worker Registration mit Auto-Update
// updateViaCache: 'none' verhindert Browser-Caching des SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // WICHTIG: Browser darf SW nicht cachen
      });

      // Prüfe alle 60 Sekunden auf Updates
      setInterval(() => {
        registration.update().catch(err => console.log('SW update check failed:', err));
      }, 60 * 1000);

      // Bei neuer Version sofort aktivieren
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Neue Version verfügbar - wird durch skipWaiting automatisch aktiviert
              console.log('Neue Version wird aktiviert...');
            }
          });
        }
      });

      // Bei Controller-Wechsel Seite neu laden
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('Service Worker Update - Seite wird neu geladen');
          window.location.reload();
        }
      });

    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}
