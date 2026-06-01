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

// ── Update-Banner: zeigt "Neue Version verfügbar" wenn Deploy stattgefunden hat ─
// Nur beim Tab-Wechsel geprüft (kein Polling, kein Traffic), dann Banner einblenden.
const BUILT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
if (BUILT_VERSION) {
  let bannerShown = false;

  const showUpdateBanner = () => {
    if (bannerShown) return;
    bannerShown = true;
    const banner = document.createElement('div');
    banner.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
      'z-index:99999', 'display:flex', 'align-items:center', 'gap:1rem',
      'background:linear-gradient(135deg,rgba(26,26,46,0.99) 0%,rgba(12,12,28,1) 100%)',
      'border:1px solid rgba(212,175,55,0.5)', 'border-radius:12px',
      'padding:0.875rem 1.25rem', 'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      'backdrop-filter:blur(20px)', 'font-family:inherit', 'font-size:0.9rem',
      'color:rgba(255,255,255,0.9)', 'max-width:90vw',
    ].join(';');
    banner.innerHTML = `
      <span style="font-size:1.1rem">🔄</span>
      <span>Neue Version verfügbar</span>
      <button id="_sw_update_btn" style="
        background:rgba(212,175,55,0.2);border:1px solid rgba(212,175,55,0.6);
        color:#d4af37;border-radius:8px;padding:0.4rem 0.9rem;cursor:pointer;
        font-size:0.85rem;font-weight:600;white-space:nowrap;font-family:inherit;
      ">Jetzt aktualisieren</button>
      <button id="_sw_close_btn" style="
        background:none;border:none;color:rgba(255,255,255,0.4);
        cursor:pointer;font-size:1.1rem;padding:0 0.25rem;font-family:inherit;
      ">✕</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('_sw_update_btn')?.addEventListener('click', async () => {
      // Cache-Clearing: best effort — Navigation passiert IMMER, auch bei Fehler
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }
      } catch (_) {}
      // Cache-busting URL → zwingt Browser zu frischem HTTP-Request für index.html
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now());
      window.location.replace(url.toString());
    });
    document.getElementById('_sw_close_btn')?.addEventListener('click', () => banner.remove());
  };

  const checkVersion = async () => {
    if (bannerShown) return;
    try {
      const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const { v } = await r.json();
      if (v && v !== BUILT_VERSION) showUpdateBanner();
    } catch {}
  };

  // Nur beim Tab-Rückkehr prüfen — kein Interval, kein unnötiger Traffic
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
  // Einmal nach dem ersten Laden (verzögert, damit die App erst fertig geladen ist)
  setTimeout(checkVersion, 10000);
}

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
