import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// i18n - Internationalisierung
import './locales/i18n';

// Design System - Neue zentrale Styles
import './design-system/index.css';

// Legacy Styles (werden schrittweise migriert)
import './styles/designsystem.css';
import './styles/themes.css';
import './styles/Buttons.css';
import './styles/components.css';
import './styles/utility-classes.css'; // BEM-konforme Utility-Klassen (ds- Präfix)

// Theme-spezifische Styles (global für Theme-Switching)
import './styles/Dashboard-TdaVib.css';
import { DatenProvider } from '@shared/DatenContext.jsx';
import axios from 'axios';
import config from './config/config.js';
import { fetchCsrfToken, getCsrfToken } from './services/api.js';

// Axios-Basis-URL konfigurieren
// WICHTIG: Alle axios-Aufrufe sollten relative Pfade verwenden (z.B. '/events'),
// NICHT ${config.apiBaseUrl}/events - das führt zu doppelten /api/api/ Pfaden!
axios.defaults.baseURL = config.apiBaseUrl;

// Phase 3 Security: Cookies automatisch mitsenden (Session-Auth)
axios.defaults.withCredentials = true;

// CSRF-Token beim App-Start holen
fetchCsrfToken().then(() => {
  console.log('🔐 [Security] CSRF-Schutz initialisiert');
}).catch(err => {
  console.warn('⚠️ [Security] CSRF-Token konnte nicht geladen werden:', err.message);
});

// Globaler Request Interceptor - Session-Auth mit JWT-Fallback
axios.interceptors.request.use(
  (reqConfig) => {
    // CSRF-Token für state-changing Requests
    const stateChangingMethods = ['post', 'put', 'delete', 'patch'];
    if (stateChangingMethods.includes(reqConfig.method?.toLowerCase())) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        reqConfig.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // JWT-Fallback für Übergangsphase (wird später entfernt)
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// React Query Client mit Default-Optionen für API-Caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 Minuten fresh
      gcTime: 30 * 60 * 1000,          // 30 Minuten im Cache
      retry: 1,                        // 1 Retry bei Fehler
      refetchOnWindowFocus: false,     // Kein Auto-Refetch bei Fokus
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DatenProvider>
          <App />
        </DatenProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Service Worker Registration (PWA) - MIT AUTO-UPDATE
// WICHTIG: NUR im Browser registrieren, NICHT in installierter App (verhindert Flacker-Loop)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

if ('serviceWorker' in navigator && !isStandalone) {
  console.log('📱 PWA läuft im Browser - Service Worker wird registriert');
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registriert:', registration.scope);

        // SOFORT nach neuen Updates suchen
        registration.update();

        // Bei neuem Service Worker: SOFORT aktivieren (skipWaiting)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 Neuer Service Worker gefunden, warte auf Installation...');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Neuer SW installiert - SOFORT aktivieren ohne Nachfrage
              console.log('✅ Neuer Service Worker installiert - Aktiviere sofort...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Bei Controller-Wechsel: Seite neu laden für neuen SW
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            console.log('🔄 Service Worker aktualisiert - Lade Seite neu...');
            window.location.reload();
          }
        });

        // Update-Check alle 5 Minuten (statt 1 Stunde)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch((error) => {
        console.warn('⚠️ Service Worker Registrierung fehlgeschlagen:', error);
      });
  });
} else if (isStandalone) {
  console.log('🚀 PWA läuft als installierte App - Service Worker DEAKTIVIERT (verhindert Flackern)');

  // Cleanup: Unregister existing service workers in standalone mode
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        console.log('🧹 Deregistriere Service Worker in standalone mode:', registration.scope);
        registration.unregister();
      });
    });
  }
}
