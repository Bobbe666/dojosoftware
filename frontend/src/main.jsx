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

// _v-Query-Param (Cache-Bypass) nach Update-Reload aus URL entfernen
if (new URLSearchParams(window.location.search).has('_v')) {
  const clean = new URL(window.location.href);
  clean.searchParams.delete('_v');
  window.history.replaceState(null, '', clean.toString());
}

// i18n - Internationalisierung
import './locales/i18n';

// Design System — Tokens ZUERST (Quelle der Wahrheit für alle var(--ds-*))
import './design-system/ds-tokens.css';
import './design-system/ds-components.css';
import './styles/custom-fonts.css';   // eigene Schriften (Karate, Bonzai)
// Gespeicherte Theme-Anpassungen sofort anwenden (vor dem Rendern)
import { initTheme } from './utils/dsTheme';
initTheme();
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
// Member-Portal Theme — MUSS als absolut letztes CSS geladen werden!
// html[data-theme="tda-vib"] Selektor → Spezifität (0,2,1) schlägt alle anderen (0,2,0) Regeln.
import './styles/MemberPortalTheme.css';
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

// Branding vor Login: Theme der Subdomain laden (nutzt /api/dojo-theme/public)
import { initPublicTheme } from './utils/dsTheme';
initPublicTheme();

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

// (Update-Banner konsolidiert → einzige Quelle: <UpdateBanner/> in App.jsx)

// ── Service Worker: Push-Notifications ───────────────────────────────────────
// HINWEIS: SW hat keinen fetch-Handler und kein Caching — nur Push-Notifications.
// Deshalb kein auto-reload auf controllerchange (würde Update-Loop erzeugen).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  }).catch(err => {
    console.warn('[SW] Registrierung fehlgeschlagen:', err.message);
  });
}
