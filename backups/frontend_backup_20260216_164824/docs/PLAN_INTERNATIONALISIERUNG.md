# Internationalisierung (i18n) - Implementierungsplan

## Übersicht

Dieses Dokument beschreibt die schrittweise Einführung von Mehrsprachigkeit in der Dojo-Software.

**Ziel:** Unterstützung von Deutsch, Englisch und weiteren Sprachen
**Technologie:** react-i18next + i18next
**Geschätzter Aufwand:** 3-4 Implementierungsphasen

---

## Phase 1: Grundgerüst einrichten

### 1.1 Pakete installieren

```bash
cd frontend
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

### 1.2 Ordnerstruktur anlegen

```
frontend/
├── public/
│   └── locales/
│       ├── de/
│       │   ├── common.json      # Allgemeine Texte (Buttons, Labels)
│       │   ├── auth.json        # Login, Registrierung
│       │   ├── member.json      # Mitgliederverwaltung
│       │   ├── finance.json     # Finanzen, Verträge
│       │   ├── exam.json        # Prüfungen, Gürtel
│       │   └── errors.json      # Fehlermeldungen
│       ├── en/
│       │   ├── common.json
│       │   ├── auth.json
│       │   └── ...
│       └── fr/
│           └── ...
└── src/
    └── i18n/
        └── index.js             # i18n Konfiguration
```

### 1.3 i18n Konfiguration erstellen

**Datei: `src/i18n/index.js`**

```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: ['de', 'en', 'fr'],
    defaultNS: 'common',
    ns: ['common', 'auth', 'member', 'finance', 'exam', 'errors'],

    interpolation: {
      escapeValue: false, // React escaped bereits
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
```

### 1.4 In App einbinden

**Datei: `src/main.jsx`**

```javascript
import './i18n';  // Vor App-Import!
import App from './App';
// ...
```

---

## Phase 2: Übersetzungsdateien erstellen

### 2.1 Beispiel: common.json (Deutsch)

```json
{
  "buttons": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "add": "Hinzufügen",
    "search": "Suchen",
    "filter": "Filtern",
    "export": "Exportieren",
    "back": "Zurück",
    "next": "Weiter",
    "confirm": "Bestätigen",
    "close": "Schließen"
  },
  "labels": {
    "yes": "Ja",
    "no": "Nein",
    "active": "Aktiv",
    "inactive": "Inaktiv",
    "date": "Datum",
    "name": "Name",
    "email": "E-Mail",
    "phone": "Telefon",
    "address": "Adresse",
    "notes": "Bemerkungen"
  },
  "messages": {
    "loading": "Wird geladen...",
    "saving": "Wird gespeichert...",
    "saved": "Erfolgreich gespeichert",
    "deleted": "Erfolgreich gelöscht",
    "error": "Ein Fehler ist aufgetreten",
    "confirmDelete": "Wirklich löschen?",
    "noData": "Keine Daten vorhanden"
  },
  "validation": {
    "required": "Dieses Feld ist erforderlich",
    "invalidEmail": "Ungültige E-Mail-Adresse",
    "invalidPhone": "Ungültige Telefonnummer",
    "minLength": "Mindestens {{min}} Zeichen erforderlich",
    "maxLength": "Maximal {{max}} Zeichen erlaubt"
  }
}
```

### 2.2 Beispiel: common.json (Englisch)

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "filter": "Filter",
    "export": "Export",
    "back": "Back",
    "next": "Next",
    "confirm": "Confirm",
    "close": "Close"
  },
  "labels": {
    "yes": "Yes",
    "no": "No",
    "active": "Active",
    "inactive": "Inactive",
    "date": "Date",
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "address": "Address",
    "notes": "Notes"
  },
  "messages": {
    "loading": "Loading...",
    "saving": "Saving...",
    "saved": "Successfully saved",
    "deleted": "Successfully deleted",
    "error": "An error occurred",
    "confirmDelete": "Really delete?",
    "noData": "No data available"
  },
  "validation": {
    "required": "This field is required",
    "invalidEmail": "Invalid email address",
    "invalidPhone": "Invalid phone number",
    "minLength": "At least {{min}} characters required",
    "maxLength": "Maximum {{max}} characters allowed"
  }
}
```

### 2.3 Beispiel: member.json (Deutsch)

```json
{
  "title": "Mitgliederverwaltung",
  "tabs": {
    "overview": "Übersicht",
    "personal": "Persönliche Daten",
    "contact": "Kontakt",
    "medical": "Medizinisch",
    "progress": "Fortschritt",
    "attendance": "Anwesenheit",
    "finance": "Finanzen",
    "contract": "Vertrag",
    "documents": "Dokumente",
    "family": "Familie & Vertreter",
    "belt": "Gurt & Stil / Prüfung",
    "courses": "Lehrgänge & Ehrungen",
    "security": "Sicherheit"
  },
  "fields": {
    "firstName": "Vorname",
    "lastName": "Nachname",
    "dateOfBirth": "Geburtsdatum",
    "gender": "Geschlecht",
    "memberNumber": "Mitgliedsnummer",
    "entryDate": "Eintrittsdatum",
    "exitDate": "Austrittsdatum",
    "status": "Status"
  },
  "gender": {
    "male": "Männlich",
    "female": "Weiblich",
    "diverse": "Divers"
  },
  "status": {
    "active": "Aktiv",
    "inactive": "Inaktiv",
    "paused": "Pausiert",
    "cancelled": "Gekündigt"
  },
  "actions": {
    "newMember": "Neues Mitglied",
    "editMember": "Mitglied bearbeiten",
    "deleteMember": "Mitglied löschen"
  }
}
```

---

## Phase 3: Komponenten umstellen

### 3.1 Verwendung in Komponenten

**Vorher:**
```jsx
<button>Speichern</button>
<p>Noch keine Daten vorhanden</p>
```

**Nachher:**
```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <>
      <button>{t('buttons.save')}</button>
      <p>{t('messages.noData')}</p>
    </>
  );
}
```

### 3.2 Mit Namespace

```jsx
import { useTranslation } from 'react-i18next';

function MemberList() {
  const { t } = useTranslation('member');

  return (
    <h1>{t('title')}</h1>  // "Mitgliederverwaltung"
  );
}
```

### 3.3 Mit Variablen

```jsx
// JSON: "welcome": "Willkommen, {{name}}!"
<p>{t('welcome', { name: user.vorname })}</p>

// JSON: "memberCount": "{{count}} Mitglied(er)"
<p>{t('memberCount', { count: members.length })}</p>
```

### 3.4 Pluralisierung

```json
{
  "memberCount_one": "{{count}} Mitglied",
  "memberCount_other": "{{count}} Mitglieder"
}
```

```jsx
t('memberCount', { count: 1 })  // "1 Mitglied"
t('memberCount', { count: 5 })  // "5 Mitglieder"
```

---

## Phase 4: Sprachumschalter

### 4.1 Komponente erstellen

**Datei: `src/components/LanguageSwitcher.jsx`**

```jsx
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // Optional: In DB speichern
    // axios.put('/api/user/language', { language: lng });
  };

  return (
    <div className="language-switcher">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          className={i18n.language === lang.code ? 'active' : ''}
          title={lang.name}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
```

### 4.2 Sprache in User-Profil speichern

**Backend-Erweiterung:**

```sql
ALTER TABLE mitglieder ADD COLUMN sprache VARCHAR(5) DEFAULT 'de';
ALTER TABLE admins ADD COLUMN sprache VARCHAR(5) DEFAULT 'de';
```

**Frontend beim Login:**

```javascript
// Nach erfolgreichem Login
const userLanguage = response.data.user.sprache || 'de';
i18n.changeLanguage(userLanguage);
```

---

## Phase 5: Backend-Meldungen

### 5.1 Fehler-Codes statt Texte

**Backend (vorher):**
```javascript
res.status(400).json({ error: 'E-Mail bereits vergeben' });
```

**Backend (nachher):**
```javascript
res.status(400).json({
  error: 'EMAIL_ALREADY_EXISTS',
  message: 'E-Mail bereits vergeben'  // Fallback
});
```

**Frontend:**
```jsx
// errors.json
{
  "EMAIL_ALREADY_EXISTS": "Diese E-Mail-Adresse ist bereits vergeben",
  "INVALID_CREDENTIALS": "Ungültige Anmeldedaten",
  "SESSION_EXPIRED": "Ihre Sitzung ist abgelaufen"
}

// Verwendung
catch (error) {
  const errorKey = error.response?.data?.error;
  const message = t(`errors:${errorKey}`, { defaultValue: error.response?.data?.message });
  alert(message);
}
```

---

## Phase 6: Datumsformate & Zahlen

### 6.1 Datums-Formatierung

```jsx
import { useTranslation } from 'react-i18next';

function FormattedDate({ date }) {
  const { i18n } = useTranslation();

  return new Date(date).toLocaleDateString(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// de: 22.01.2026
// en: 01/22/2026
```

### 6.2 Währungs-Formatierung

```jsx
function FormattedCurrency({ amount }) {
  const { i18n } = useTranslation();

  return new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

// de: 29,99 €
// en: €29.99
```

---

## Migrations-Strategie

### Schritt-für-Schritt Vorgehen

| Schritt | Komponenten | Priorität |
|---------|-------------|-----------|
| 1 | Login, Registrierung | Hoch |
| 2 | Dashboard, Navigation | Hoch |
| 3 | Mitglieder-Übersicht | Mittel |
| 4 | Mitglieder-Detail (alle Tabs) | Mittel |
| 5 | Finanzen, Verträge | Mittel |
| 6 | Prüfungen, Kurse | Mittel |
| 7 | Admin-Bereich | Niedrig |
| 8 | E-Mail-Templates | Niedrig |
| 9 | PDF-Generierung | Niedrig |

### Hilfs-Skript zum Finden von Strings

```bash
# Findet alle deutschen Texte in JSX-Dateien
grep -rn "\"[A-ZÄÖÜ][a-zäöüß]*\"" src/components/ --include="*.jsx" | grep -v "import\|className\|style"
```

---

## Checkliste pro Komponente

- [ ] `useTranslation` importieren
- [ ] Alle statischen Texte durch `t()` ersetzen
- [ ] Texte in JSON-Dateien eintragen (DE + EN)
- [ ] Variablen/Pluralisierung prüfen
- [ ] Datumsformate prüfen
- [ ] Testen in beiden Sprachen

---

## Geschätzter Zeitaufwand

| Phase | Aufwand |
|-------|---------|
| Phase 1: Grundgerüst | 2-3 Stunden |
| Phase 2: JSON-Dateien (Basis) | 4-6 Stunden |
| Phase 3: Komponenten umstellen | 15-20 Stunden |
| Phase 4: Sprachumschalter | 1-2 Stunden |
| Phase 5: Backend-Meldungen | 3-4 Stunden |
| Phase 6: Formate | 1-2 Stunden |
| **Gesamt** | **~30-40 Stunden** |

---

## Nützliche Links

- [react-i18next Dokumentation](https://react.i18next.com/)
- [i18next Dokumentation](https://www.i18next.com/)
- [Pluralisierung](https://www.i18next.com/translation-function/plurals)
- [Interpolation](https://www.i18next.com/translation-function/interpolation)

---

*Plan erstellt am: 22.01.2026*
