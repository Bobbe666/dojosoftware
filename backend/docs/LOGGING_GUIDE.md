# Logging Best Practices Guide

## Problem

Die Codebase enthält aktuell **229+ console.log/console.error Statements**, die:
- Nicht strukturiert sind
- Schwer zu filtern/durchsuchen sind
- Kein Logging-Level haben
- In Production nicht gemanagt werden können

## Lösung: Strukturierter Logger

Wir haben bereits einen strukturierten Logger in `utils/logger.js`.

### Logger-Methoden

```javascript
const logger = require('../utils/logger');

// Verschiedene Log-Levels
logger.info('Informations-Nachricht');
logger.success('Erfolgreiche Operation');
logger.warn('Warnung');
logger.error('Fehler aufgetreten');
logger.debug('Debug-Information');
```

### Mit strukturierten Daten

```javascript
// ❌ FALSCH (alte Art)
console.log('User logged in:', userId, email);

// ✅ RICHTIG (neue Art)
logger.info('User logged in', { userId, email });
```

### Fehler-Logging

```javascript
// ❌ FALSCH
console.error('Database error:', err);

// ✅ RICHTIG
logger.error('Database error', {
  error: err.message,
  stack: err.stack,
  query: sqlQuery
});
```

### API-Request Logging

```javascript
// ❌ FALSCH
console.log('GET /api/mitglieder');

// ✅ RICHTIG
logger.info('API Request', {
  method: req.method,
  path: req.path,
  dojoId: req.dojo_id,
  userId: req.user_id
});
```

## Migration Plan

### Phase 1: Kritische Pfade (Sofort)

Ersetze console.log in:
- `routes/auth.js` - Login/Authentifizierung
- `routes/mitglieder.js` - Mitgliederverwaltung
- `routes/vertraege.js` - Vertragsverwaltung
- `routes/transaktionen.js` - Zahlungen

### Phase 2: Alle anderen Routes (Diese Woche)

Systematisch durch alle 74 Route-Dateien gehen.

### Phase 3: Middleware & Utils (Nächste Woche)

Alle Utility-Funktionen und Middleware.

## Automatisiertes Ersetzen

### Suchen & Ersetzen mit Regex (VS Code)

1. **Suchen:** `console\.log\((.*?)\);`
2. **Ersetzen:** `logger.info($1);`

3. **Suchen:** `console\.error\((.*?)\);`
4. **Ersetzen:** `logger.error($1);`

**WICHTIG:** Manuell nachprüfen, da nicht alle Patterns passen!

### Bash One-Liner (für einfache Fälle)

```bash
# Alle console.log in einer Datei ersetzen
sed -i '' 's/console\.log(/logger.info(/g' routes/auth.js

# Alle console.error ersetzen
sed -i '' 's/console\.error(/logger.error(/g' routes/auth.js
```

## Checkliste pro Datei

- [ ] Logger importieren: `const logger = require('../utils/logger');`
- [ ] Alle `console.log` durch `logger.info` ersetzen
- [ ] Alle `console.error` durch `logger.error` ersetzen
- [ ] Parameter in Objekt-Form bringen: `{ key: value }`
- [ ] Testen ob Route noch funktioniert
- [ ] Git Commit

## Monitoring Setup (Optional, Production)

In Production können Logs zentral gesammelt werden:

```javascript
// In logger.js erweitern für Production
if (process.env.NODE_ENV === 'production') {
  // Winston Transports für:
  // - File Logging
  // - CloudWatch / Papertrail
  // - Sentry für Errors
}
```

## Beispiele aus der Codebase

### Vorher (routes/auth.js)

```javascript
console.log("User logged in:", email);
console.error("Login failed:", err);
```

### Nachher

```javascript
logger.info('User logged in', { email, dojoId: user.dojo_id });
logger.error('Login failed', { error: err.message, email });
```

## Performance

Strukturiertes Logging hat **vernachlässigbaren Performance-Overhead** (<1ms pro Log).
Der Nutzen (Debugging, Monitoring) überwiegt deutlich!
