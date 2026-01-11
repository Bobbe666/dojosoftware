import { registerSW } from 'virtual:pwa-register';

export const registerServiceWorker = () => {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('Neue Version verfügbar! Jetzt aktualisieren?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App ist offline verfügbar');
    },
    onRegistered(registration) {
      console.log('Service Worker registriert');

      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error('Service Worker Registrierung fehlgeschlagen:', error);
    }
  });

  return updateSW;
};
