import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// i18n - Internationalisierung
import './locales/i18n';

// Design System - Neue zentrale Styles
import './design-system/index.css';

// Legacy Styles (schrittweise Migration zu design-system/components/*.css)
// TODO: designsystem.css → nach vollständiger Token-Migration entfernen
import './styles/designsystem.css';
// TODO: themes.css → theme-midnight.css + theme-tda-vib.css (bereits in design-system)
import './styles/themes.css';
// TODO: Buttons.css → ds-btn Klassen aus design-system/components/Button.css verwenden
import './styles/Buttons.css';
// TODO: components.css → schrittweise in design-system/components/ auslagern
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

// Service Worker DEAKTIVIERT - Verhindert Blink-Loop
// Service Worker komplett entfernt um Reload-Probleme zu verhindern
console.log('🚫 Service Worker ist deaktiviert');
