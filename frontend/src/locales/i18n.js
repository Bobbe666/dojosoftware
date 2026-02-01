import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Nur Deutsche Übersetzungen für den Fallback vorladen (schneller Start)
import de_common from './de/common.json';
import de_auth from './de/auth.json';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Deutsche Basis-Übersetzungen vorladen für sofortigen Start
    resources: {
      de: {
        common: de_common,
        auth: de_auth
      }
    },

    // Backend für Lazy Loading der restlichen Übersetzungen
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      // Cache für bessere Performance
      requestOptions: {
        cache: 'default'
      }
    },

    // Einstellungen
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'member', 'members', 'finance', 'courses'],

    // Nur benötigte Namespaces beim Start laden
    partialBundledLanguages: true,

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    },

    interpolation: {
      escapeValue: false
    },

    react: {
      useSuspense: false
    },

    // Debug in Entwicklung (optional)
    // debug: process.env.NODE_ENV === 'development'
  });

export default i18n;
