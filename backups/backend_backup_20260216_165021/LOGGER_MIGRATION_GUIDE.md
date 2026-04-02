# Logger Migration Guide

## Übersicht

Dieser Guide hilft bei der Migration von `console.log` Statements zum strukturierten Logger.

### Status
- **Gefundene console.log Statements**: ~200+ in Backend-Code
- **Betroffene Dateien**: Alle Routes, Services, Scripts

---

## 1. Logger einbinden

```javascript
// Alt
console.log("✅ Server gestartet auf Port 3000");

// Neu
const logger = require('./utils/logger');
logger.success('Server gestartet', { port: 3000 });
```

---

## 2. Migrations-Mapping

### Error-Logging

```javascript
// Alt
console.error("❌ Datenbankfehler:", err);

// Neu
logger.error('Datenbankfehler', { error: err.message, stack: err.stack });
```

### API-Requests

```javascript
// Alt
console.log("📢 GET /api/mitglieder");

// Neu
logger.api('GET /api/mitglieder', { method: 'GET', path: '/api/mitglieder' });
```

### Datenbank-Operationen

```javascript
// Alt
console.log("🗄️ Mitglied erstellt mit ID:", id);

// Neu
logger.database('Mitglied erstellt', { mitgliedId: id });
```

### Auth-Operationen

```javascript
// Alt
console.log("🔐 Login erfolgreich:", username);

// Neu
logger.auth('Login erfolgreich', { username });
```

### Payment-Operationen

```javascript
// Alt
console.log("💳 Zahlung verarbeitet:", amount);

// Neu
logger.payment('Zahlung verarbeitet', { amount, currency: 'EUR' });
```

### Debug-Informationen

```javascript
// Alt
console.log("🔍 Debug:", data);

// Neu
logger.debug('Debug-Info', { data });
```

### Warnings

```javascript
// Alt
console.warn("⚠️ Warnung: Duplikat gefunden");

// Neu
logger.warn('Duplikat gefunden', { details: '...' });
```

---

## 3. Log-Levels

| Level | Verwendung | Beispiel |
|-------|-----------|----------|
| `error` | Kritische Fehler | Datenbankfehler, Crashes |
| `warn` | Warnungen | Duplikate, veraltete APIs |
| `info` | Wichtige Events | Server-Start, Erfolgreiche Operationen |
| `http` | HTTP-Requests | API-Calls, Routes |
| `debug` | Debug-Infos | Detaillierte Daten für Development |

---

## 4. Kategorien

```javascript
logger.database(message, meta)  // 🗄️ Datenbank
logger.api(message, meta)       // 📡 API
logger.auth(message, meta)      // 🔐 Auth
logger.payment(message, meta)   // 💳 Payment
logger.email(message, meta)     // 📧 Email
logger.success(message, meta)   // ✅ Success
```

---

## 5. Meta-Daten Best Practices

### Gut ✅
```javascript
logger.error('Datenbankfehler beim Erstellen', {
    table: 'mitglieder',
    error: err.message,
    userId: req.user.id
});
```

### Schlecht ❌
```javascript
logger.error('Fehler: ' + err.message);  // Keine strukturierten Daten
```

---

## 6. Migration Priority

### High Priority (sofort migrieren):
1. `server.js` - Server-Start-Logs
2. `routes/*.js` - API-Endpoint-Logs
3. Fehler-Logging (alle `console.error`)

### Medium Priority:
4. `services/*.js` - Service-Logs
5. Wichtige Geschäftslogik

### Low Priority:
6. Debug-Logs in Development-Scripts
7. Migrations-Scripts

---

## 7. Beispiel-Migration: server.js

### Vorher
```javascript
console.log("🚀 Starting DojoSoftware Backend Server...");
console.log("✅ Server läuft auf http://localhost:3000");
console.error("❌ Fehler beim Starten:", err);
```

### Nachher
```javascript
const logger = require('./utils/logger');

logger.info('Starting DojoSoftware Backend Server');
logger.success('Server läuft', {
    url: 'http://localhost:3000',
    port: 3000,
    environment: process.env.NODE_ENV
});
logger.error('Fehler beim Starten', { error: err.message, stack: err.stack });
```

---

## 8. Umgebungsvariablen

### `.env` erweitern:
```bash
# Logging
NODE_ENV=production          # production | development | test
LOG_LEVEL=info               # error | warn | info | http | debug
```

### Development
- Log-Level: `debug`
- Console-Output: Ja, mit Emojis
- File-Output: Ja

### Production
- Log-Level: `info`
- Console-Output: Strukturiert (JSON)
- File-Output: Ja
- Log-Rotation: 30 Tage

---

## 9. Log-Dateien

Logs werden gespeichert in `Backend/logs/`:

```
logs/
├── 2025-01-23-error.log      # Nur Errors
├── 2025-01-23-warn.log       # Nur Warnings
├── 2025-01-23-info.log       # Info & höher
├── 2025-01-23-http.log       # HTTP-Requests
├── 2025-01-23-debug.log      # Debug-Infos
└── 2025-01-23-all.log        # Alle Logs
```

---

## 10. Quick-Replace Script

### Suchen & Ersetzen (Regex):

| Alt | Neu |
|-----|-----|
| `console\.log\("✅ (.+?)", (.+?)\)` | `logger.success('$1', { data: $2 })` |
| `console\.log\("📢 (.+?)"\)` | `logger.api('$1')` |
| `console\.error\("❌ (.+?)", (.+?)\)` | `logger.error('$1', { error: $2 })` |
| `console\.log\("🗄️ (.+?)", (.+?)\)` | `logger.database('$1', { data: $2 })` |

**Achtung**: Manuelle Überprüfung nach Auto-Replace erforderlich!

---

## 11. Testing

```javascript
// In Tests: Logger ist stumm bei NODE_ENV=test
process.env.NODE_ENV = 'test';
const logger = require('./utils/logger');

// Keine Console-Ausgabe, keine File-Writes
logger.info('Test läuft');
```

---

## 12. Monitoring & Alerting

### Zukünftige Erweiterungen:
- Winston: Professional Logging Framework
- Log-Aggregation: Elasticsearch + Kibana
- Error-Tracking: Sentry Integration
- Alerting: Slack/Email bei Errors

---

## 13. Checkliste für Migration

- [ ] `logger.js` erstellt und getestet
- [ ] `server.js` migriert
- [ ] Alle `console.error` → `logger.error`
- [ ] Alle API-Route-Logs → `logger.api`
- [ ] Service-Logs migriert
- [ ] `.env` mit LOG_LEVEL erweitert
- [ ] Tests angepasst
- [ ] Log-Rotation getestet
- [ ] Alte `console.log` entfernt

---

## 14. Support & Fragen

Bei Fragen zur Logger-Migration:
1. Siehe `Backend/utils/logger.js` für API-Referenz
2. Siehe Beispiele in migriertem Code
3. Teste mit `NODE_ENV=development` für Emoji-Ausgabe

Happy Logging! 📝
