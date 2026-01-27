# Changelog - 27. Januar 2026

## Übersicht der heutigen Änderungen

Alle Änderungen wurden zu GitHub gepusht und warten auf Deployment.

---

## 1. Bundle-Größen-Optimierung (85% Reduktion)

**Commit:** `5f27524` - "Implement aggressive lazy loading for 85% bundle size reduction"

### Was wurde gemacht:
- ~100 Komponenten auf React.lazy() umgestellt
- Code-Splitting nach Features (finance, sales, members, admin, etc.)
- vite.config.js mit optimierten manualChunks

### Ergebnisse:
| Bundle | Vorher | Nachher | Reduktion |
|--------|--------|---------|-----------|
| index.js | 1.35 MB | 195 KB | **-85%** |
| Initial Load | Alles | Login + Landing | Schneller |

### Betroffene Dateien:
- `frontend/src/App.jsx` - Lazy Loading für alle Komponenten
- `frontend/src/main.jsx` - React Query Provider
- `frontend/vite.config.js` - Chunk-Konfiguration

---

## 2. CSS-Konflikte behoben (BEM-Konvention)

**Commit:** `19f1db1` - "Implement BEM naming convention and scoped utility classes"

### Problem:
Globale CSS-Selektoren wie `.card-header`, `.form-group`, `.btn-primary` überschrieben sich gegenseitig (51 Dateien betroffen).

### Lösung:
1. **Neue Utility-Klassen** mit `ds-` Präfix (Design System)
2. **BEM-Namenskonvention** dokumentiert
3. **Parent-Scoping** für bestehende Komponenten

### Neue Dateien:
- `frontend/src/styles/CSS-NAMING-CONVENTION.md` - Dokumentation
- `frontend/src/styles/utility-classes.css` - Scoped Utilities

### Neue CSS-Klassen (ds-* Präfix):
```css
/* Buttons */
.ds-btn, .ds-btn-primary, .ds-btn-secondary, .ds-btn-danger

/* Forms */
.ds-form-group, .ds-form-input, .ds-form-select, .ds-form-label

/* Cards */
.ds-card, .ds-card-header, .ds-card-body, .ds-card-footer

/* Modals */
.ds-modal-overlay, .ds-modal, .ds-modal-header, .ds-modal-body

/* Stats */
.ds-stat-card, .ds-stat-value, .ds-stat-label, .ds-stat-icon

/* Layout */
.ds-flex, .ds-grid, .ds-gap-md, .ds-p-lg

/* Text */
.ds-text-gold, .ds-text-xl, .ds-font-bold
```

### Empfehlung für neue Komponenten:
```jsx
// NICHT SO (globale Konflikte):
<div className="card-header">

// BESSER (BEM mit Komponenten-Präfix):
<div className="events__card-header">

// ODER (scoped Utility):
<div className="ds-card-header">
```

---

## 3. Dashboard NaN-Fixes

**Commit:** `0c0ea61` - "Fix NaN display in SuperAdmin dashboard widgets"

### Was wurde gemacht:
- `formatNumber()` Helper für sichere Zahlenformatierung
- `EmptyState` Komponente für leere Zustände
- Alle Charts mit Fallback-Anzeige

### Betroffene Dateien:
- `frontend/src/components/StatisticsTab.jsx`
- `frontend/src/components/FinanceTab.jsx`

---

## 4. Light/Dark Mode Konsistenz-Fixes

### Problem:
Hardcodierte Farben (`white`, `#fff`, `#ffffff`) verursachten "weiß auf weiß"-Probleme im Light Mode.

### Lösung:
CSS-Variablen statt hardcodierter Farben, Dark-Mode-Support via `[data-theme="dark"]` Selektoren.

### Geänderte Dateien:
| Datei | Änderung |
|-------|----------|
| `AnwesenheitDashboard.css` | `.kalender-tag` → `var(--bg-card)` |
| `AnwesenheitGrid.css` | `.kurs-kachel` → `var(--bg-card)` |
| `AnwesenheitKalender.css` | `.react-calendar` → `var(--bg-card)` |
| `AuditLog.css` | Alle `white` → `var(--bg-card)`, Dark-Mode-Selektoren hinzugefügt |
| `ArtikelVerwaltung.css` | `.search-filters select` → `var(--bg-card)` |
| `StandortSwitcher.css` | Dark-Mode-Overrides für Dropdown hinzugefügt |
| `RaumVerwaltung.css` | Dark-Mode-Overrides für Cards/Forms hinzugefügt |

### Wichtige CSS-Variablen für Theming:
```css
/* Hintergründe */
var(--bg-card)        /* Karten-Hintergrund */
var(--bg-card-hover)  /* Karten-Hover */
var(--bg-secondary)   /* Sekundärer Hintergrund */
var(--bg-surface)     /* Oberflächen */

/* Text */
var(--text-primary)   /* Haupttext */
var(--text-secondary) /* Nebentext */

/* Borders */
var(--border-default) /* Standard-Rahmen */
```

### Dark-Mode-Selektoren (für neue Komponenten):
```css
/* Standard-Selector für Dark Mode */
[data-theme="dark"] .my-component {
  background: var(--bg-card);
  color: var(--text-primary);
}
```

---

## 5. Mobile Responsiveness Fixes

### Problem:
Feature-Cards gingen über den Bildschirmrand hinaus auf kleinen Geräten. Grids mit `minmax(400px+, 1fr)` verursachten horizontalen Overflow.

### Lösung:
1. **CSS `min()` Funktion** für sichere Grid-Spalten: `minmax(min(100%, 380px), 1fr)`
2. **Globale Mobile-Breakpoints** in utility-classes.css für max-width: 480px

### Geänderte Dateien (12 Stück):
| Datei | Vorher | Nachher |
|-------|--------|---------|
| Events.css | `minmax(450px, 1fr)` | `minmax(min(100%, 400px), 1fr)` |
| DojosVerwaltung.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| CourseRating.css | `minmax(450px, 1fr)` | `minmax(min(100%, 400px), 1fr)` |
| CourseRatingAdmin.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| EquipmentManagement.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| Personal.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| MitgliedDetail.css | 2x `minmax(400-450px)` | `minmax(min(100%, 380-400px), 1fr)` |
| Auswertungen.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| StandortVerwaltung.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| ArtikelgruppenVerwaltung.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| Lastschriftlauf.css | `minmax(400px, 1fr)` | `minmax(min(100%, 380px), 1fr)` |
| utility-classes.css | - | Globale 480px Breakpoint-Fixes |

### Technik: CSS `min()` Funktion
```css
/* Vorher - overflow auf Screens < 400px */
grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));

/* Nachher - safe für alle Bildschirmgrößen */
grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
```

Die `min(100%, 380px)` Funktion wählt den kleineren Wert:
- Auf breiten Screens: `380px` (normale Card-Breite)
- Auf schmalen Screens: `100%` (volle Breite, kein Overflow)

---

## Deployment-Befehl

```bash
ssh dojo.tda-intl.org "cd /var/www/dojosoftware && git pull origin main && cd frontend && npm install && npm run build && pm2 restart dojosoftware-backend"
```

### Server-Details:
- **Host:** dojo.tda-intl.org (185.80.92.166)
- **SSH-Config:** `~/.ssh/config` mit Key `id_ed25519_dojo_deploy`
- **PM2-Prozess:** `dojosoftware-backend`
- **Frontend:** https://dojo.tda-intl.org
- **Backend API:** https://dojo.tda-intl.org/api/

---

## Für die Zukunft merken

### CSS-Entwicklung:
1. **Keine globalen Selektoren** wie `.btn`, `.card`, `.form-group`
2. **Komponenten-Präfix verwenden**: `.events__card-header`, `.personal__form-group`
3. **Oder ds-* Utilities**: `.ds-btn-primary`, `.ds-card`
4. **Dokumentation lesen**: `frontend/src/styles/CSS-NAMING-CONVENTION.md`

### Performance:
1. **Neue Komponenten immer lazy laden** mit `React.lazy()`
2. **Große Libraries in manualChunks** in vite.config.js
3. **Build-Größe prüfen** nach größeren Änderungen

### Zahlenformatierung:
1. **Immer `formatNumber()` verwenden** für Anzeige
2. **Null/undefined prüfen** mit `value ?? 0`
3. **EmptyState Komponente** für leere Datensätze

### Light/Dark Mode Styling:
1. **Keine hardcodierten Farben** wie `white`, `#fff`, `#ffffff`
2. **CSS-Variablen verwenden**: `var(--bg-card)`, `var(--text-primary)`
3. **Dark-Mode-Overrides** mit `[data-theme="dark"]` Selektor
4. **Fallback-Werte** angeben: `var(--bg-card, rgba(255,255,255,0.05))`

### Mobile Responsiveness:
1. **Niemals feste minmax-Werte > 320px** ohne `min()` Funktion
2. **Sichere Grid-Syntax**: `minmax(min(100%, 380px), 1fr)` statt `minmax(400px, 1fr)`
3. **Breakpoints testen**: 320px (iPhone SE), 375px (iPhone), 768px (Tablet)
4. **Flex-Container**: Immer `flex-wrap: wrap` für Mobile-Fallback
5. **Sidebars**: Mit Media Query verstecken oder stacken auf Mobile
