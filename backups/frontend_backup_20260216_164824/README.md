# DojoSoftware Frontend

React-basiertes Frontend für die DojoSoftware Mitgliederverwaltung.

## Überblick

Das Frontend ist eine moderne Single-Page-Application (SPA), die mit React 18 und Vite entwickelt wurde. Es bietet eine intuitive Benutzeroberfläche für die Verwaltung von Dojos, Mitgliedern, Verträgen, Kursen und mehr.

## Technologie-Stack

- **React 18** - UI-Library mit Hooks
- **Vite** - Build-Tool und Dev-Server (schnelles HMR)
- **React Router** - Client-seitiges Routing
- **Recharts** - Charting-Library für Visualisierungen
- **CSS Custom Properties** - Theming-System
- **Fetch API** - HTTP-Requests zum Backend

## Features

- Responsive Design für Desktop und Tablet
- Dark Theme mit anpassbaren Farben pro Dojo
- Real-time Updates durch API-Integration
- Datei-Upload (Fotos, Dokumente)
- PDF-Generierung und -Download
- NFC-basiertes Check-In-System
- Interaktive Dashboards und Statistiken
- Multi-Dojo-Unterstützung

## Installation

```bash
npm install
```

## Konfiguration

Erstellen Sie eine `.env` Datei im Frontend-Verzeichnis:

```env
VITE_API_URL=http://localhost:3002
VITE_CHECKIN_API_URL=http://localhost:3003
```

## Entwicklung

### Dev-Server starten

```bash
npm run dev
```

Die Anwendung läuft auf `http://localhost:5173`.

### Build für Produktion

```bash
npm run build
```

Build-Artefakte werden in `dist/` erstellt.

### Preview des Production Builds

```bash
npm run preview
```

## Projektstruktur

```
Frontend/
├── public/
│   └── (statische Assets)
├── src/
│   ├── components/          # React-Komponenten
│   │   ├── Dashboard.jsx           # Admin-Dashboard
│   │   ├── MitgliedDetailShared.jsx # Mitglied-Detailansicht
│   │   ├── MitgliederListe.jsx     # Mitglieder-Übersicht
│   │   ├── VertragErstellen.jsx    # Vertragserstellung
│   │   ├── SepaMandatErstellen.jsx # SEPA-Mandat erstellen
│   │   ├── KursVerwaltung.jsx      # Kursverwaltung
│   │   ├── CheckinSystem.jsx       # NFC Check-In
│   │   ├── RechnungsUebersicht.jsx # Rechnungen
│   │   ├── DojoSettings.jsx        # Dojo-Einstellungen
│   │   └── ...
│   ├── contexts/            # React Context Provider
│   │   ├── AuthContext.jsx         # Authentifizierung
│   │   └── DojoContext.jsx         # Dojo-Daten
│   ├── styles/              # CSS-Dateien
│   │   ├── App.css                 # Globale Styles
│   │   ├── Dashboard.css           # Dashboard-Styles
│   │   ├── MitgliedDetail.css      # Mitglied-Detail-Styles
│   │   ├── CheckinSystem.css       # Check-In-Styles
│   │   └── ...
│   ├── utils/               # Hilfsfunktionen
│   │   └── api.js                  # API-Helper
│   ├── App.jsx              # Hauptkomponente mit Routing
│   ├── main.jsx             # Entry Point
│   └── index.css            # Root CSS
├── .env                     # Umgebungsvariablen
├── vite.config.js           # Vite-Konfiguration
├── package.json
└── README.md                # Diese Datei
```

## Hauptkomponenten

### Dashboard.jsx

Admin-Dashboard mit Übersicht über:
- Mitgliederstatistiken
- Offene Rechnungen
- Check-In-Statistiken
- Aktuelle Kurse
- Umsatzentwicklung (Diagramme)

### MitgliedDetailShared.jsx

Detaillierte Mitgliederansicht mit Tabs:
- **Stammdaten**: Persönliche Informationen, Foto
- **Verträge**: Aktive und archivierte Verträge
- **Familie**: Familienbeziehungen und Kontoinhaber
- **Kurse**: Kursbelegung und -bewertungen
- **Prüfungen**: Gürtelprüfungen und Fortschritt
- **Dokumente**: SEPA-Mandate, generierte Dokumente, Einverständniserklärungen
- **Rechnungen**: Zahlungshistorie
- **Check-Ins**: Anwesenheitshistorie

### MitgliederListe.jsx

Mitglieder-Übersicht mit:
- Such- und Filterfunktionen
- Status-Filter (aktiv/inaktiv)
- Sortierung
- Quick Actions (Bearbeiten, Details)
- Export-Funktionen

### CheckinSystem.jsx

NFC-basiertes Check-In-System:
- NFC-Karten-Scanner
- Manuelle ID-Eingabe
- Check-In-Bestätigung mit Foto
- Echtzeit-Anwesenheitsliste
- Check-In-Statistiken

### VertragErstellen.jsx

Vertragserstellung mit:
- Vorlagenauswahl
- Eingabe von Vertragsdaten
- Platzhalter-Preview
- PDF-Generierung
- Digitale Unterschrift (geplant)

### KursVerwaltung.jsx

Kursverwaltung mit:
- Kursübersicht
- Teilnehmerverwaltung
- Anwesenheitstracking
- Bewertungssystem
- Kursplanung

## Routing

Das Routing erfolgt über React Router:

```jsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/mitglieder" element={<MitgliederListe />} />
  <Route path="/mitglieder/:id" element={<MitgliedDetailShared />} />
  <Route path="/vertraege" element={<VertraegeUebersicht />} />
  <Route path="/vertraege/neu" element={<VertragErstellen />} />
  <Route path="/kurse" element={<KursVerwaltung />} />
  <Route path="/checkin" element={<CheckinSystem />} />
  <Route path="/rechnungen" element={<RechnungsUebersicht />} />
  <Route path="/einstellungen" element={<DojoSettings />} />
  {/* ... weitere Routen */}
</Routes>
```

## State Management

### Context API

**AuthContext** - Verwaltet Authentifizierung:
```jsx
const { user, token, login, logout } = useAuth();
```

**DojoContext** - Verwaltet Dojo-Daten und -Einstellungen:
```jsx
const { currentDojo, dojos, switchDojo } = useDojo();
```

### Component State

React Hooks für lokalen State:
```jsx
const [mitglieder, setMitglieder] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
```

## API-Integration

API-Calls erfolgen über Fetch API mit Token-Authentifizierung:

```javascript
// utils/api.js
const API_URL = import.meta.env.VITE_API_URL;

export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
};
```

**Verwendung:**
```javascript
import { fetchWithAuth } from '../utils/api';

const mitglieder = await fetchWithAuth('/api/mitglieder');
```

## Styling

### CSS-Struktur

- **index.css**: Root-Styles und CSS Custom Properties
- **App.css**: Layout und globale Komponenten-Styles
- **[Component].css**: Komponenten-spezifische Styles

### Theming mit CSS Custom Properties

```css
:root {
  --farbe-hauptfarbe: #FFD700;
  --farbe-akzent: #FF6B35;
  --farbe-hintergrund: #1a1a1a;
  --farbe-card: #2a2a2a;
  --farbe-text: #ffffff;
  --farbe-text-secondary: rgba(255, 255, 255, 0.7);
  --farbe-border: rgba(255, 255, 255, 0.1);
}
```

Diese Variablen werden dynamisch aus Dojo-Einstellungen geladen:

```javascript
useEffect(() => {
  if (currentDojo) {
    document.documentElement.style.setProperty('--farbe-hauptfarbe', currentDojo.hauptfarbe);
    document.documentElement.style.setProperty('--farbe-akzent', currentDojo.akzentfarbe);
  }
}, [currentDojo]);
```

### Responsive Design

Das Layout ist responsiv gestaltet für:
- Desktop (1920px+)
- Laptop (1366px+)
- Tablet (768px+)

```css
@media (max-width: 1366px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .card {
    padding: 1rem;
  }
}
```

## Datei-Upload

Beispiel für Foto-Upload:

```javascript
const handleFotoUpload = async (event, mitgliedId) => {
  const file = event.target.files[0];
  const formData = new FormData();
  formData.append('foto', file);

  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}/api/mitglieder/${mitgliedId}/foto`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (data.success) {
    console.log('Foto erfolgreich hochgeladen:', data.foto_pfad);
  }
};
```

## PDF-Download

PDF-Downloads werden über Blob-Handling realisiert:

```javascript
const downloadPDF = async (url, filename) => {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${url}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(downloadUrl);
};
```

## NFC-Integration

NFC-Karten-Scanning für Check-In-System:

```javascript
const startNFCScanning = async () => {
  if ('NDEFReader' in window) {
    try {
      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.addEventListener('reading', ({ message, serialNumber }) => {
        console.log('NFC-Karte erkannt:', serialNumber);
        handleCheckin(serialNumber);
      });
    } catch (error) {
      console.error('NFC-Scan fehlgeschlagen:', error);
    }
  } else {
    console.warn('NFC wird von diesem Browser nicht unterstützt');
  }
};
```

**Browser-Kompatibilität:**
- Chrome/Edge: Volle Unterstützung
- Firefox/Safari: Eingeschränkt/keine Unterstützung

## Performance-Optimierungen

### Code-Splitting

Vite führt automatisches Code-Splitting durch:

```javascript
const Dashboard = lazy(() => import('./components/Dashboard'));

<Suspense fallback={<LoadingSpinner />}>
  <Dashboard />
</Suspense>
```

### Memoization

Verwenden Sie React.memo für teure Komponenten:

```javascript
const MitgliedCard = React.memo(({ mitglied }) => {
  return (
    <div className="mitglied-card">
      {/* ... */}
    </div>
  );
});
```

### useCallback und useMemo

```javascript
const handleSearch = useCallback((searchTerm) => {
  setSearchTerm(searchTerm);
}, []);

const filteredMitglieder = useMemo(() => {
  return mitglieder.filter(m =>
    m.vorname.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [mitglieder, searchTerm]);
```

## Error Handling

Zentrale Fehlerbehandlung:

```javascript
const [error, setError] = useState(null);

try {
  const data = await fetchWithAuth('/api/mitglieder');
  setMitglieder(data.data);
} catch (err) {
  setError('Fehler beim Laden der Mitglieder');
  console.error(err);
}

{error && (
  <div className="error-message">
    ⚠️ {error}
  </div>
)}
```

## Debugging

### React DevTools

Installieren Sie React DevTools für Chrome/Firefox zum Debugging von:
- Komponenten-Hierarchie
- Props und State
- Hooks
- Performance-Profiling

### Console Logs

Entwicklungs-Logs:

```javascript
if (import.meta.env.DEV) {
  console.log('Mitglieder geladen:', mitglieder);
}
```

### Vite DevTools

Vite bietet HMR (Hot Module Replacement) für schnelle Entwicklung:
- Änderungen werden sofort im Browser reflektiert
- State bleibt bei Code-Änderungen erhalten

## Testing

```bash
# Unit Tests
npm test

# E2E Tests
npm run test:e2e
```

### Test-Beispiel mit React Testing Library:

```javascript
import { render, screen } from '@testing-library/react';
import MitgliedCard from './MitgliedCard';

test('renders mitglied name', () => {
  const mitglied = {
    vorname: 'Max',
    nachname: 'Mustermann'
  };

  render(<MitgliedCard mitglied={mitglied} />);

  expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
});
```

## Build-Optimierung

### Vite-Konfiguration

```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
};
```

## Deployment

### Production Build

```bash
npm run build
```

Artefakte werden in `dist/` erstellt und können auf jedem Static-File-Server gehostet werden:

- **Netlify**
- **Vercel**
- **GitHub Pages**
- **Apache/Nginx**

### Environment Variables

Stellen Sie sicher, dass Produktions-URLs konfiguriert sind:

```env
VITE_API_URL=https://api.dojosoftware.com
VITE_CHECKIN_API_URL=https://checkin.dojosoftware.com
```

### Nginx-Konfiguration

```nginx
server {
  listen 80;
  server_name dojosoftware.com;

  root /var/www/dojosoftware/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Troubleshooting

### Port bereits belegt

```bash
# Vite läuft auf anderem Port
npm run dev -- --port 5174
```

### HMR funktioniert nicht

```bash
# Vite-Cache löschen
rm -rf node_modules/.vite
npm run dev
```

### Build-Fehler

```bash
# Node Modules neu installieren
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Best Practices

1. **Komponenten klein halten** - Einzelne Verantwortlichkeit
2. **Wiederverwendbare Komponenten** - DRY-Prinzip
3. **Props validieren** - PropTypes oder TypeScript
4. **State minimieren** - Nur notwendigen State speichern
5. **Side Effects mit useEffect** - Cleanup nicht vergessen
6. **Accessibility** - ARIA-Labels, Keyboard-Navigation
7. **CSS-Scoping** - BEM oder CSS-Modules verwenden
8. **Error Boundaries** - Fehler abfangen
9. **Loading States** - UX-Feedback für Benutzer
10. **Code-Reviews** - Peer-Reviews vor Merge

## Weitere Ressourcen

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [Recharts Documentation](https://recharts.org/)

## Weitere Dokumentation

- [Hauptprojekt README](../README.md)
- [Backend README](../Backend/README.md)

---

Letzte Aktualisierung: Oktober 2025
