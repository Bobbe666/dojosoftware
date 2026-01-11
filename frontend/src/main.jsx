import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/designsystem.css';
import './styles/themes.css';
import './styles/Buttons.css';
import './styles/components.css';
import './styles/PWAMobileEnhancements.css';
import { DatenProvider } from '@shared/DatenContext.jsx';
import axios from 'axios';
import config from './config/config.js';
import { registerServiceWorker } from './utils/registerServiceWorker.js';

// Axios-Basis-URL konfigurieren
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

// Register Service Worker for PWA - TEMPORARILY DISABLED FOR DEBUGGING
// if ('serviceWorker' in navigator) {
//   registerServiceWorker();
// }
