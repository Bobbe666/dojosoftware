# Claude Session Notes - DojoSoftware

**Letzte Aktualisierung:** 31. Januar 2026, 14:30 Uhr

---

## WICHTIG: Arbeitsverzeichnis

**Projekt:** DojoSoftware (NICHT tda-intl!)
**Pfad:** `/Users/schreinersascha/dojosoftware/`
- Frontend: `/Users/schreinersascha/dojosoftware/frontend/`
- Backend: `/Users/schreinersascha/dojosoftware/backend/`

**Lokale Entwicklung:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`
- API-URL: `VITE_API_URL=http://localhost:5001/api`
- DB: lokale MySQL (dojoUser / DojoLocal2025!)

**KEINE Arbeit mit Produktionsdatenbank!**

---

## Aktuelles Refactoring-Projekt

### Ziel: Große Route-Dateien aufteilen

| Datei | Zeilen | Priorität |
|-------|--------|-----------|
| `mitglieder.js` | 3.395 | 1 - In Arbeit |
| `admin.js` | 2.270 | 2 |
| `pruefungen.js` | 2.147 | 3 |

### Neue Struktur für mitglieder.js:
```
routes/mitglieder/
├── index.js          # Haupt-Router
├── crud.js           # GET /, POST /, PUT /:id, DELETE /:id
├── filter.js         # /filter/*, /filter-options/*
├── medical.js        # /:id/medizinisch
├── stile.js          # /:id/stile, /:id/stil/:stil_id/*
├── sepa.js           # /:id/sepa-mandate/*
├── archiv.js         # /archiv, /:id/archivieren
```

### Zu verwendende Tools:
- Validation Middleware: `requireFields`, `validateId`, `validateEmail`, etc.
- Error Handling: `ApiError`, `asyncHandler`
- Logger: `logger.info()`, `logger.error()`, etc.

---

## Fortschritt

- [x] Analyse der Codebase
- [x] REFACTORING_GUIDE.md erstellt
- [~] mitglieder.js aufteilen (IN ARBEIT)
  - [x] filter.js erstellt (255 Zeilen)
  - [x] sepa.js erstellt (302 Zeilen)
  - [x] stile.js erstellt (392 Zeilen)
  - [x] index.js erstellt (27 Zeilen)
  - [ ] crud.js (ausstehend)
  - [ ] medical.js (ausstehend)
  - [ ] archiv.js (ausstehend)
- [ ] admin.js aufteilen
- [ ] pruefungen.js aufteilen
- [ ] console.log → logger ersetzen
- [ ] Tests anpassen

### Erstellte Module (976 Zeilen extrahiert):
```
routes/mitglieder/
├── index.js    (27 Zeilen)  - Haupt-Router
├── filter.js   (255 Zeilen) - Filter-Endpoints
├── sepa.js     (302 Zeilen) - SEPA-Mandate
├── stile.js    (392 Zeilen) - Stile & Graduierungen
```

---

## Befehle

```bash
# Backend starten
cd /Users/schreinersascha/dojosoftware/backend && npm run dev

# Frontend starten
cd /Users/schreinersascha/dojosoftware/frontend && npm run dev
```
