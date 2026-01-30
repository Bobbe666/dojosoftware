import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Deutsche Übersetzungen
import de_common from './de/common.json';
import de_auth from './de/auth.json';
import de_dashboard from './de/dashboard.json';
import de_member from './de/member.json';

// Englische Übersetzungen
import en_common from './en/common.json';
import en_auth from './en/auth.json';
import en_dashboard from './en/dashboard.json';
import en_member from './en/member.json';

// Italienische Übersetzungen
import it_common from './it/common.json';
import it_auth from './it/auth.json';
import it_dashboard from './it/dashboard.json';
import it_member from './it/member.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: {
        common: de_common,
        auth: de_auth,
        dashboard: de_dashboard,
        member: de_member
      },
      en: {
        common: en_common,
        auth: en_auth,
        dashboard: en_dashboard,
        member: en_member
      },
      it: {
        common: it_common,
        auth: it_auth,
        dashboard: it_dashboard,
        member: it_member
      }
    },
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'member'],
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
    }
  });

export default i18n;
