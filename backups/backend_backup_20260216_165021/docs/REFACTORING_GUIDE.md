# Refactoring Guide - DojoSoftware Backend

## Route-Dateien aufteilen

### Problem
Einige Route-Dateien sind zu groß und schwer wartbar:
- `mitglieder.js` - 3.395 Zeilen
- `admin.js` - 2.270 Zeilen
- `pruefungen.js` - 2.147 Zeilen

### Lösung: Modulare Struktur

**Vorher:**
```
routes/
  mitglieder.js (3395 Zeilen)
```

**Nachher:**
```
routes/
  mitglieder/
    index.js          # Haupt-Router, kombiniert Sub-Router
    crud.js           # GET /, POST /, PUT /:id, DELETE /:id
    filter.js         # /filter/*, /filter-options/*
    medical.js        # /:id/medizinisch
    stile.js          # /:id/stile, /:id/stil/:stil_id/*
    sepa.js           # /:id/sepa-mandate/*
    archiv.js         # /archiv, /:id/archivieren
```

### Beispiel: Filter-Routes extrahieren

**1. Neue Datei erstellen: `routes/mitglieder/filter.js`**
```javascript
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

// Stile-Optionen
router.get("/filter-options/stile", (req, res) => {
    // ... Code aus mitglieder.js kopieren
});

// Gurt-Optionen
router.get("/filter-options/gurte", (req, res) => {
    // ...
});

// Ohne SEPA
router.get("/filter/ohne-sepa", (req, res) => {
    // ...
});

module.exports = router;
```

**2. Index-Datei erstellen: `routes/mitglieder/index.js`**
```javascript
const express = require('express');
const router = express.Router();

// Sub-Router importieren
const filterRoutes = require('./filter');
const crudRoutes = require('./crud');
const sepaRoutes = require('./sepa');
// ...

// Sub-Router einbinden
router.use('/', filterRoutes);  // /filter-options/*, /filter/*
router.use('/', crudRoutes);    // /, /:id
router.use('/', sepaRoutes);    // /:id/sepa-mandate/*

module.exports = router;
```

**3. In server.js ändern:**
```javascript
// Vorher
app.use('/api/mitglieder', require('./routes/mitglieder'));

// Nachher (gleicher Pfad, andere Dateistruktur)
app.use('/api/mitglieder', require('./routes/mitglieder'));
```

---

## Validation Middleware verwenden

### Verfügbare Validatoren

```javascript
const {
    requireFields,
    validateId,
    validateEmail,
    validateDate,
    validateString,
    validateEnum,
    validateIBAN,
    validateDojoId,
    sanitizeStrings
} = require('../middleware/validation');
```

### Beispiele

**Pflichtfelder prüfen:**
```javascript
router.post('/',
    requireFields(['vorname', 'nachname', 'email']),
    (req, res) => {
        // Felder sind garantiert vorhanden
    }
);
```

**ID validieren:**
```javascript
router.get('/:id',
    validateId('id'),
    (req, res) => {
        // req.params.id ist eine gültige positive Ganzzahl
    }
);
```

**Kombinierte Validierung:**
```javascript
router.post('/',
    requireFields(['email', 'geburtsdatum', 'zahlungsmethode']),
    validateEmail('email'),
    validateDate('geburtsdatum', { maxDate: new Date().toISOString().split('T')[0] }),
    validateEnum('zahlungsmethode', ['Lastschrift', 'Überweisung', 'Bar']),
    sanitizeStrings(['vorname', 'nachname', 'bemerkungen']),
    (req, res) => {
        // Alle Felder sind validiert und sanitized
    }
);
```

---

## Error Handling

### ApiError Klasse verwenden

```javascript
const { ApiError, asyncHandler } = require('../middleware/errorHandler');

// Mit asyncHandler für async Funktionen
router.get('/:id', asyncHandler(async (req, res) => {
    const result = await db.promise().query('SELECT * FROM mitglieder WHERE id = ?', [req.params.id]);

    if (result[0].length === 0) {
        throw ApiError.notFound('Mitglied nicht gefunden');
    }

    res.json({ success: true, data: result[0][0] });
}));
```

### ApiError Factory-Methoden

```javascript
ApiError.badRequest(message, details)     // 400
ApiError.unauthorized(message)            // 401
ApiError.forbidden(message)               // 403
ApiError.notFound(message)                // 404
ApiError.conflict(message, details)       // 409
ApiError.validationError(errors)          // 422
ApiError.internal(message)                // 500
```

---

## Logger verwenden

### Anstatt console.log:

```javascript
const logger = require('../utils/logger');

// Statt console.log('Mitglied erstellt:', mitglied_id)
logger.info('Mitglied erstellt', { mitglied_id });

// Statt console.error('Fehler:', err)
logger.error('Fehler beim Erstellen', { error: err.message });

// Für Debug-Ausgaben
logger.debug('Query-Parameter', { params: req.query });
```

### Log-Kategorien

```javascript
logger.success('Operation erfolgreich', { ... });
logger.database('DB-Query', { ... });
logger.auth('Login-Versuch', { ... });
logger.payment('Zahlung verarbeitet', { ... });
```

---

## Migrations-Checkliste

Beim Refactoring einer Route-Datei:

- [ ] Neue Ordnerstruktur erstellen
- [ ] Routes logisch gruppieren
- [ ] Imports anpassen (Pfade!)
- [ ] Validation Middleware hinzufügen
- [ ] console.log → logger ersetzen
- [ ] Error Handling mit ApiError
- [ ] Tests schreiben/anpassen
- [ ] In server.js aktualisieren (falls nötig)
- [ ] Alte Datei löschen
- [ ] Manuell testen
