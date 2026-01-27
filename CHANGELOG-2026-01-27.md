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

## Deployment-Befehl

Wenn der Server wieder erreichbar ist:

```bash
ssh root@213.136.81.36 "cd /var/www/dojosoftware && git pull origin main && cd frontend && npm install && npm run build && pm2 restart dojo-backend"
```

Oder manuell auf dem Server:
```bash
cd /var/www/dojosoftware
git pull origin main
cd frontend
npm install
npm run build
pm2 restart dojo-backend
```

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
