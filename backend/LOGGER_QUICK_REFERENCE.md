# Logger Quick Reference

Schnellreferenz für die tägliche Verwendung des strukturierten Loggers.

---

## Import

```javascript
const logger = require('./utils/logger');
// oder
const logger = require('../utils/logger');
```

---

## Basic Usage

### Informationen

```javascript
logger.info('Server gestartet');
logger.info('Benutzer angemeldet', { userId: 123, email: 'user@example.com' });
```

### Fehler

```javascript
logger.error('Datenbankfehler', {
    error: err.message,
    stack: err.stack
});

logger.error('API-Fehler', {
    endpoint: '/api/mitglieder',
    error: err.message,
    userId: req.user.id
});
```

### Warnungen

```javascript
logger.warn('Duplikat gefunden', { mitgliedId: 123 });
logger.warn('API deprecated', { endpoint: '/old-api' });
```

### Debug

```javascript
logger.debug('Query ausgeführt', {
    query: 'SELECT * FROM mitglieder',
    duration: 45
});
```

---

## Kategorien

### Database 🗄️

```javascript
logger.database('Mitglied erstellt', {
    mitgliedId: result.insertId,
    dojoId: req.body.dojo_id
});

logger.database('Query fehlgeschlagen', {
    error: err.message,
    query: sqlQuery
});
```

### API 📡

```javascript
logger.api('GET /api/mitglieder', {
    method: 'GET',
    path: '/api/mitglieder',
    userId: req.user.id
});

logger.api('POST /api/mitglieder', {
    method: 'POST',
    body: req.body,
    ip: req.ip
});
```

### Auth 🔐

```javascript
logger.auth('Login erfolgreich', {
    userId: user.id,
    email: user.email,
    ip: req.ip
});

logger.auth('Login fehlgeschlagen', {
    email: req.body.email,
    reason: 'Ungültiges Passwort'
});

logger.auth('Token validiert', { userId: 123 });
```

### Payment 💳

```javascript
logger.payment('Zahlung verarbeitet', {
    amount: 50.00,
    currency: 'EUR',
    mitgliedId: 123,
    provider: 'stripe'
});

logger.payment('Zahlung fehlgeschlagen', {
    error: err.message,
    mitgliedId: 123
});
```

### Email 📧

```javascript
logger.email('E-Mail gesendet', {
    to: 'user@example.com',
    subject: 'Willkommen',
    type: 'welcome'
});

logger.email('E-Mail fehlgeschlagen', {
    to: 'user@example.com',
    error: err.message
});
```

### Success ✅

```javascript
logger.success('Mitglied erstellt', { mitgliedId: 123 });
logger.success('Route geladen', { path: '/api/auth' });
logger.success('Migration abgeschlossen');
```

---

## Best Practices

### ✅ GUT

```javascript
// Strukturierte Daten
logger.error('Datenbankfehler', {
    error: err.message,
    code: err.code,
    table: 'mitglieder',
    userId: req.user.id
});

// Kontext hinzufügen
logger.auth('Login', {
    success: true,
    userId: user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
});

// Kategorie verwenden
logger.database('Query', { table: 'mitglieder', duration: 45 });
```

### ❌ SCHLECHT

```javascript
// String-Konkatenation
logger.info('Mitglied ' + id + ' erstellt');

// Keine Kontext-Daten
logger.error('Fehler');

// Falscher Log-Level
logger.debug('KRITISCHER FEHLER!!!'); // Sollte error sein
```

---

## Log-Level

| Level | Wann verwenden | Beispiel |
|-------|----------------|----------|
| **error** | Kritische Fehler | Datenbank-Crash, API-Fehler |
| **warn** | Warnungen | Duplikate, veraltete APIs |
| **info** | Wichtige Events | Login, Mitglied erstellt |
| **http** | HTTP-Requests | GET /api/mitglieder |
| **debug** | Debug-Infos | Query-Details, Variablen |

---

## Common Patterns

### API-Route

```javascript
router.post('/api/mitglieder', async (req, res) => {
    logger.api('POST /api/mitglieder', {
        method: 'POST',
        userId: req.user?.id,
        ip: req.ip
    });

    try {
        const result = await createMitglied(req.body);

        logger.database('Mitglied erstellt', {
            mitgliedId: result.insertId,
            dojoId: req.body.dojo_id
        });

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        logger.error('Fehler beim Erstellen', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            userId: req.user?.id
        });

        res.status(500).json({ error: err.message });
    }
});
```

### Database-Query

```javascript
db.query(query, values, (err, results) => {
    if (err) {
        logger.error('Query fehlgeschlagen', {
            error: err.message,
            code: err.code,
            query: query,
            values: values
        });
        return callback(err);
    }

    logger.database('Query erfolgreich', {
        table: 'mitglieder',
        rowCount: results.length
    });

    callback(null, results);
});
```

### Authentication

```javascript
passport.authenticate('local', (err, user, info) => {
    if (err) {
        logger.error('Auth-Fehler', {
            error: err.message,
            ip: req.ip
        });
        return next(err);
    }

    if (!user) {
        logger.warn('Login fehlgeschlagen', {
            email: req.body.email,
            reason: info.message,
            ip: req.ip
        });
        return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    logger.auth('Login erfolgreich', {
        userId: user.id,
        email: user.email,
        ip: req.ip
    });

    res.json({ user });
});
```

### Payment-Processing

```javascript
async function processPayment(amount, mitgliedId) {
    logger.payment('Zahlung gestartet', {
        amount,
        mitgliedId,
        timestamp: new Date()
    });

    try {
        const result = await stripe.charges.create({...});

        logger.payment('Zahlung erfolgreich', {
            amount,
            mitgliedId,
            chargeId: result.id,
            status: result.status
        });

        return result;
    } catch (err) {
        logger.error('Zahlung fehlgeschlagen', {
            error: err.message,
            amount,
            mitgliedId,
            code: err.code
        });
        throw err;
    }
}
```

---

## Environment-Konfiguration

### .env

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug

# Production
NODE_ENV=production
LOG_LEVEL=info
```

### Log-Level filtern

```bash
# Nur Errors anzeigen
LOG_LEVEL=error node server.js

# Alles anzeigen (inkl. Debug)
LOG_LEVEL=debug node server.js
```

---

## Log-Dateien

```
Backend/logs/
├── 2025-01-23-error.log      # Nur Fehler
├── 2025-01-23-warn.log       # Nur Warnungen
├── 2025-01-23-info.log       # Info & höher
├── 2025-01-23-http.log       # HTTP-Requests
├── 2025-01-23-debug.log      # Debug-Infos
└── 2025-01-23-all.log        # Alle Logs
```

### Logs live verfolgen

```bash
# Alle Logs
tail -f Backend/logs/$(date +%Y-%m-%d)-all.log

# Nur Errors
tail -f Backend/logs/$(date +%Y-%m-%d)-error.log

# Nur HTTP-Requests
tail -f Backend/logs/$(date +%Y-%m-%d)-http.log
```

---

## Migration von console.log

| Alt | Neu |
|-----|-----|
| `console.log("Info")` | `logger.info('Info')` |
| `console.log("Data:", data)` | `logger.info('Data', { data })` |
| `console.error("Error:", err)` | `logger.error('Error', { error: err.message })` |
| `console.warn("Warning")` | `logger.warn('Warning')` |
| `console.log("📢 API Call")` | `logger.api('API Call')` |
| `console.log("🗄️ DB Query")` | `logger.database('DB Query')` |
| `console.log("✅ Success")` | `logger.success('Success')` |

---

## Tipps

1. **Immer Meta-Daten hinzufügen**: `{ userId, action, timestamp }`
2. **Kategorien nutzen**: `logger.database()`, `logger.api()`, etc.
3. **Error-Details loggen**: `{ error: err.message, stack: err.stack }`
4. **Kontext ist König**: IP, User-ID, Request-ID hinzufügen
5. **Richtige Log-Level**: error = kritisch, info = wichtig, debug = Details

---

Viel Erfolg! 📝
