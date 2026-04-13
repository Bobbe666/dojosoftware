import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// ── Sentry Fehler-Monitoring ──────────────────────────────────────────────────
// DSN eintragen: https://sentry.io → Projekt erstellen → DSN kopieren
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.2,      // 20% der Requests werden getraced
    replaysSessionSampleRate: 0, // Session-Replay nur bei Fehlern
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection',
    ],
  });
}

// i18n - Internationalisierung
import './locales/i18n';

// Design System - Neue zentrale Styles
import './design-system/index.css';

// Legacy Styles (schrittweise Migration zu design-system/components/*.css läuft)
import './styles/designsystem.css';  // Ablösung: nach vollständiger Token-Migration entfernen
import './styles/themes.css';        // Ablösung: theme-midnight.css + theme-tda-vib.css (bereits in design-system)
import './styles/Buttons.css';       // Ablösung: ds-btn Klassen aus design-system/components/Button.css
import './styles/components.css';    // Ablösung: schrittweise in design-system/components/ auslagern
import './styles/utility-classes.css'; // BEM-konforme Utility-Klassen (ds- Präfix)

// Theme-spezifische Styles (global für Theme-Switching)
import './styles/Dashboard-TdaVib.css';
// Washi Theme — MUSS nach allen Legacy-CSS-Dateien (inkl. themes.css) geladen werden!
// themes.css setzt :root { dark vars } mit gleicher Spezifität wie [data-theme="tda-vib"].
// CSS-Cascade: später gewinnt → theme-tda-vib.css muss als letztes im Bundle landen.
import './design-system/themes/theme-tda-vib.css';
// Tab-Style-System (nach allen anderen CSS geladen — source-order gewinnt)
import './styles/tab-styles.css';
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

// Tab-Stil und Akzentfarbe sofort anwenden (vor erstem Render — kein Flash)
const _savedTabStyle = localStorage.getItem('dojo-tab-style');
if (_savedTabStyle && _savedTabStyle !== 'glass') {
  document.documentElement.dataset.tabStyle = _savedTabStyle;
}
const _savedTabAccent = localStorage.getItem('dojo-tab-accent');
if (_savedTabAccent) {
  document.documentElement.style.setProperty('--tab-accent', _savedTabAccent);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Service Worker: Push-Notifications + App-Auto-Update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Nur registrieren wenn noch kein aktiver SW läuft der Probleme macht
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      // Alle 5 Minuten auf neue Version prüfen
      setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);

      // Neue Version erkannt → Banner-Event auslösen (kein Auto-Reload → verhindert Loop)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Update ist bereit — App informieren
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });

    } catch (err) {
      console.warn('Service Worker Registrierung fehlgeschlagen:', err.message);
    }
  });
}
