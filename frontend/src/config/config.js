// ===================================================================
// 🔧 DOJOSOFTWARE - FRONTEND CONFIGURATION
// ===================================================================

// Version automatisch aus Changelog holen
import { CURRENT_VERSION, CURRENT_BUILD_DATE } from '../components/SystemChangelog.jsx';

// Umgebung bestimmen
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// API-URLs für verschiedene Umgebungen
// 🔒 MULTI-TENANT: Production uses relative path to support subdomains
const API_URLS = {
  development: 'http://localhost:5001/api',
  production: '/api',
  testing: 'http://localhost:5001/api'
};

// Basis-Konfiguration
const config = {
  // API-Einstellungen
  apiBaseUrl: API_URLS[import.meta.env.MODE] || API_URLS.development,
  apiTimeout: 10000, // 10 Sekunden
  
  // Authentifizierung
  auth: {
    tokenKey: 'dojo_auth_token',
    userKey: 'dojo_user',
    expiryKey: 'dojo_session_expiry',
    sessionDuration: 8 * 60 * 60 * 1000, // 8 Stunden in Millisekunden
    refreshThreshold: 5 * 60 * 1000, // 5 Minuten vor Ablauf erneuern
  },
  
  // App-Einstellungen (Version wird automatisch aus SystemChangelog.jsx geholt!)
  app: {
    name: 'DojoSoftware',
    version: CURRENT_VERSION,  // Automatisch aus Changelog
    description: 'Kampfkunstschule Verwaltungssystem',
    author: 'Sascha Schreiner',
    buildDate: CURRENT_BUILD_DATE,  // Automatisch aus Changelog
    contactEmail: 'support@tda-intl.org',
  },
  
  // UI-Einstellungen
  ui: {
    theme: 'light', // 'light', 'dark', 'auto'
    language: 'de',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
    itemsPerPage: 20,
    animationDuration: 300,
  },
  
  // Feature-Flags
  features: {
    darkMode: true,
    notifications: true,
    exportData: true,
    advancedSearch: true,
    dashboard: true,
    memberManagement: true,
    courseManagement: true,
    trainerManagement: true,
    paymentTracking: true,
    reports: true,
    settings: true,
  },
  
  // Debug-Einstellungen
  debug: {
    enabled: isDevelopment,
    logLevel: isDevelopment ? 'debug' : 'error',
    showPerformance: isDevelopment,
    apiLogging: isDevelopment,
    authLogging: isDevelopment,
  },
  
  // Validation-Regeln
  validation: {
    password: {
      minLength: 6,
      requireNumbers: false,
      requireSpecialChars: false,
      requireUppercase: false,
    },
    email: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: {
      pattern: /^[\+]?[0-9\s\-\(\)]{6,}$/,
    },
  },
  
  // Umgebungs-spezifische Einstellungen
  environment: {
    isDevelopment,
    isProduction,
    isTesting: import.meta.env.MODE === 'test',
    nodeEnv: import.meta.env.MODE,
  },
  
  // URLs und Pfade
  paths: {
    login: '/login',
    dashboard: '/',
    members: '/mitglieder',
    courses: '/kurse',
    trainers: '/trainer',
    settings: '/einstellungen',
    profile: '/profil',
  },
  
  // Lokalisierung
  localization: {
    defaultLanguage: 'de',
    availableLanguages: ['de', 'en'],
    dateLocale: 'de-DE',
    numberFormat: 'de-DE',
  },
  
  // Cache-Einstellungen
  cache: {
    enableServiceWorker: isProduction,
    apiCacheDuration: 5 * 60 * 1000, // 5 Minuten
    imageCacheDuration: 24 * 60 * 60 * 1000, // 24 Stunden
  },
  
  // Performance-Monitoring
  performance: {
    enableMetrics: isProduction,
    sampleRate: 0.1, // 10% der Benutzer
    trackUserInteractions: false,
  },
  
  // Sicherheitseinstellungen
  security: {
    enableCSP: isProduction,
    enableHTTPS: isProduction,
    cookieSecure: isProduction,
    corsOrigins: isDevelopment ? ['http://localhost:5173'] : [],
  }
};

// Utility-Funktionen
const utils = {
  // API-URL erstellen
  createApiUrl: (endpoint) => {
    return `${config.apiBaseUrl}${endpoint}`;
  },
  
  // Debug-Logging
  log: (message, data = null) => {
    if (config.debug.enabled) {
      console.log(`🔧 Config: ${message}`, data || '');
    }
  },
  
  // Feature-Check
  isFeatureEnabled: (feature) => {
    return config.features[feature] === true;
  },
  
  // Umgebungs-Check
  isDev: () => config.environment.isDevelopment,
  isProd: () => config.environment.isProduction,
  
  // URL-Validation
  isValidUrl: (url) => {
    if (!url || typeof url !== 'string') return false;
    // Erlaube relative Pfade für Production (z.B. /api)
    if (url.startsWith('/')) return true;
    // Erlaube localhost und production URLs
    if (url.startsWith('http://localhost:')) return true;
    if (url.startsWith('http://127.0.0.1:')) return true;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  },
  
  // Lokale Storage-Helpers
  storage: {
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Storage set error:', error);
        return false;
      }
    },
    
    get: (key) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },
    
    remove: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Storage remove error:', error);
        return false;
      }
    },
    
    clear: () => {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.error('Storage clear error:', error);
        return false;
      }
    }
  }
};

// Axios-Konfiguration
const axiosConfig = {
  baseURL: config.apiBaseUrl,
  timeout: config.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: false,
};

// API-Endpunkte (Pfade relativ zur apiBaseUrl)
const API_ENDPOINTS = {
  // Authentifizierung
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
    createAdmin: '/auth/create-admin',
    hashPassword: '/auth/hash-password',
    users: '/auth/users',
    health: '/auth/health',
  },

  // Dashboard
  dashboard: {
    stats: '/dashboard/stats',
    activities: '/dashboard/recent-activities',
    charts: '/dashboard/charts',
  },

  // Mitglieder
  members: {
    list: '/mitglieder',
    create: '/mitglieder',
    get: (id) => `/mitglieder/${id}`,
    update: (id) => `/mitglieder/${id}`,
    delete: (id) => `/mitglieder/${id}`,
    search: '/mitglieder/search',
    export: '/mitglieder/export',
  },

  // Kurse
  courses: {
    list: '/kurse',
    create: '/kurse',
    get: (id) => `/kurse/${id}`,
    update: (id) => `/kurse/${id}`,
    delete: (id) => `/kurse/${id}`,
    schedule: '/kurse/schedule',
  },

  // Trainer
  trainers: {
    list: '/trainer',
    create: '/trainer',
    get: (id) => `/trainer/${id}`,
    update: (id) => `/trainer/${id}`,
    delete: (id) => `/trainer/${id}`,
  },

  // Berichte
  reports: {
    members: '/reports/members',
    courses: '/reports/courses',
    payments: '/reports/payments',
    attendance: '/reports/attendance',
  },
};

// Konfiguration validieren
const validateConfig = () => {
  const errors = [];

  // Debug: Zeige was geladen wurde
  console.log('🔍 Config Debug:', {
    mode: import.meta.env.MODE,
    apiBaseUrl: config.apiBaseUrl,
    isDevelopment,
    isProduction,
    envViteApiUrl: import.meta.env.VITE_API_URL
  });

  if (!config.apiBaseUrl) {
    errors.push('API Base URL ist nicht konfiguriert');
  }

  if (config.apiBaseUrl && !utils.isValidUrl(config.apiBaseUrl)) {
    errors.push(`API Base URL ist ungültig: "${config.apiBaseUrl}"`);
  }

  if (config.apiTimeout < 1000) {
    errors.push('API Timeout ist zu niedrig (mindestens 1000ms)');
  }

  if (errors.length > 0) {
    console.error('🚨 Konfigurationsfehler:', errors);
    // In Production nur warnen, nicht abbrechen
    if (isProduction) {
      console.warn('⚠️ Konfigurationsprobleme erkannt, fahre trotzdem fort');
    }
  }
};

// Konfiguration beim Import validieren
validateConfig();

// Debug-Output in Development
if (isDevelopment) {
  console.log('🔧 DojoSoftware Konfiguration geladen:', {
    environment: import.meta.env.MODE,
    apiUrl: config.apiBaseUrl,
    version: config.app.version,
    features: Object.keys(config.features).filter(f => config.features[f])
  });
}

// Typen für TypeScript (falls später verwendet)
const CONFIG_TYPES = {
  ENVIRONMENT: {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TESTING: 'testing'
  },
  
  THEME: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  },
  
  LOG_LEVEL: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  }
};

// Exports - alles nur einmal exportiert
export default config;
export { utils, axiosConfig, API_ENDPOINTS, CONFIG_TYPES };