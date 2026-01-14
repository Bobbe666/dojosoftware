import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Design System - Neue zentrale Styles
import './design-system/index.css';

// Legacy Styles (werden schrittweise migriert)
import './styles/designsystem.css';
import './styles/themes.css';
import './styles/Buttons.css';
import './styles/components.css';

// Theme-spezifische Styles (global für Theme-Switching)
import './styles/Dashboard-TdaVib.css';
import { DatenProvider } from '@shared/DatenContext.jsx';
import axios from 'axios';
import config from './config/config.js';

// Axios-Basis-URL konfigurieren
// WICHTIG: Alle axios-Aufrufe sollten relative Pfade verwenden (z.B. '/events'),
// NICHT ${config.apiBaseUrl}/events - das führt zu doppelten /api/api/ Pfaden!
axios.defaults.baseURL = config.apiBaseUrl;

// Globaler Request Interceptor - fügt Auth-Token automatisch hinzu
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DatenProvider>
      <App />
    </DatenProvider>
  </React.StrictMode>
);

// Service Worker Registration (PWA)
// WICHTIG: NUR im Browser registrieren, NICHT in installierter App (verhindert Flacker-Loop)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

if ('serviceWorker' in navigator && !isStandalone) {
  console.log('📱 PWA läuft im Browser - Service Worker wird registriert');
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registriert:', registration.scope);

        // Update-Check jede Stunde
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
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
