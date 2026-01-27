# Service Layer Architecture Guide

## Übersicht

Die neue 3-Tier Architektur trennt Verantwortlichkeiten klar:

```
Routes (Controller) → Services (Business Logic) → Repositories (Data Access)
```

## Architektur-Layer

### 1. **Routes** (routes/)
**Verantwortung:** HTTP-Request-Handling
- Request-Validierung
- Response-Formatierung
- Auth-Checks
- Error-Handling für HTTP

**Beispiel:**
```javascript
// routes/mitglieder.js
router.get('/', authenticateToken, async (req, res) => {
  try {
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status,
    };

    const result = await MemberService.getAllMembers(req.dojo_id, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

### 2. **Services** (services/)
**Verantwortung:** Business Logic
- Validierung
- Business Rules
- Orchestrierung mehrerer Repositories
- Logging wichtiger Events

**Beispiel:**
```javascript
// services/MemberService.js
async createMember(data, dojoId) {
  // Validierung
  if (!data.email) throw new Error('Email required');
  
  // Business Rule: Email-Eindeutigkeit
  const existing = await memberRepository.findByEmail(data.email, dojoId);
  if (existing) throw new Error('Email already exists');
  
  // Daten erstellen
  const member = await memberRepository.create(data, dojoId);
  
  // Event loggen
  logger.info('Member created', { memberId: member.id });
  
  return member;
}
```

### 3. **Repositories** (repositories/)
**Verantwortung:** Datenbank-Zugriff
- CRUD-Operationen
- Queries
- Data Mapping
- Multi-Tenancy Enforcement

**Beispiel:**
```javascript
// repositories/MemberRepository.js
async findById(id, dojoId) {
  const query = 'SELECT * FROM mitglieder WHERE id = ? AND dojo_id = ?';
  const results = await this.query(query, [id, dojoId]);
  return results[0] || null;
}
```

## Vorteile

### Separation of Concerns
- Jeder Layer hat klare Verantwortung
- Einfacher zu testen
- Einfacher zu warten

### Wiederverwendbarkeit
```javascript
// Service kann von mehreren Routes verwendet werden
MemberService.createMember(data, dojoId); // Von API Route
MemberService.createMember(data, dojoId); // Von Webhook
MemberService.createMember(data, dojoId); // Von Batch-Job
```

### Testbarkeit
```javascript
// Service-Tests ohne HTTP
const result = await MemberService.createMember(mockData, 1);
expect(result).toHaveProperty('id');

// Repository-Tests mit Test-DB
const member = await memberRepository.findById(1, 1);
expect(member.email).toBe('test@example.com');
```

### Multi-Tenancy Security
```javascript
// dojo_id wird automatisch in Repository enforced
const member = await memberRepository.findById(123, req.dojo_id);
// Kann nur Mitglieder des eigenen Dojos abfragen!
```

## Migration-Pattern

### Vorher (Monolithisch)

```javascript
// routes/mitglieder.js (3000+ Zeilen)
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const dojoId = req.dojo_id;

  // Direkte DB-Query
  db.query(
    'SELECT * FROM mitglieder WHERE id = ? AND dojo_id = ?',
    [id, dojoId],
    (err, results) => {
      if (err) {
        console.error('Error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Not found' });
      }

      // Business Logic hier vermischt
      const member = results[0];
      
      // Weitere Queries...
      db.query('SELECT * FROM vertraege WHERE mitglied_id = ?', [id], ...);
      db.query('SELECT * FROM pruefungen WHERE mitglied_id = ?', [id], ...);
      
      // Response
      res.json(member);
    }
  );
});
```

**Probleme:**
- DB-Logik in Routes
- Business-Logik vermischt
- Callback-Hell
- Schwer testbar
- Nicht wiederverwendbar

### Nachher (Service Layer)

```javascript
// routes/mitglieder.js (< 100 Zeilen!)
const MemberService = require('../services/MemberService');

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const member = await MemberService.getMemberById(
      req.params.id,
      req.dojo_id
    );
    res.json(member);
  } catch (error) {
    if (error.message === 'Member not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});
```

```javascript
// services/MemberService.js
async getMemberById(id, dojoId) {
  const member = await memberRepository.findById(id, dojoId);
  
  if (!member) {
    throw new Error('Member not found');
  }
  
  // Business Logic
  // z.B. zusätzliche Daten laden, Berechtigungen prüfen, etc.
  
  return member;
}
```

```javascript
// repositories/MemberRepository.js
async findById(id, dojoId) {
  const query = 'SELECT * FROM mitglieder WHERE id = ? AND dojo_id = ?';
  const results = await this.query(query, [id, dojoId]);
  return results[0] || null;
}
```

**Vorteile:**
- Klar getrennt
- Async/Await (kein Callback-Hell)
- Testbar
- Wiederverwendbar

## BaseRepository Pattern

Alle Repositories erweitern `BaseRepository` für Standard-CRUD:

```javascript
class MemberRepository extends BaseRepository {
  constructor() {
    super('mitglieder'); // Table name
  }

  // Automatisch verfügbar:
  // - findAll(filters, dojoId)
  // - findById(id, dojoId)
  // - create(data, dojoId)
  // - update(id, data, dojoId)
  // - delete(id, dojoId)
  // - count(filters, dojoId)
  // - query(sql, params)

  // Custom Methoden hinzufügen:
  async findByEmail(email, dojoId) {
    // ...
  }
}
```

## Migration Checkliste

Für jede Route-Datei:

### 1. Repository erstellen

```bash
# repositories/YourRepository.js
class YourRepository extends BaseRepository {
  constructor() {
    super('your_table');
  }
}
module.exports = new YourRepository();
```

### 2. Service erstellen

```bash
# services/YourService.js
const yourRepository = require('../repositories/YourRepository');

class YourService {
  async getAll(dojoId, options = {}) {
    return await yourRepository.findAll(options, dojoId);
  }
}
module.exports = new YourService();
```

### 3. Route aktualisieren

```javascript
// routes/your-route.js
const YourService = require('../services/YourService');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await YourService.getAll(req.dojo_id, req.query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

### 4. Testen

```bash
# Teste die Route
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/your-route

# Unit-Tests schreiben
# tests/unit/services/YourService.test.js
```

### 5. Alte Code löschen

```javascript
// Entferne alte db.query() Calls aus Route
// Entferne Business-Logic aus Route
```

## Best Practices

### Services sollten:
- ✅ Nie direkt `db.query()` aufrufen → Repository verwenden
- ✅ Business-Logik enthalten
- ✅ Validierung durchführen
- ✅ Fehler mit aussagekräftigen Messages werfen
- ✅ Wichtige Events loggen

### Repositories sollten:
- ✅ Nur Datenbank-Zugriff haben
- ✅ Immer dojo_id für Multi-Tenancy enforc en
- ✅ Promises zurückgeben (async/await)
- ✅ Niemals Business-Logik enthalten

### Routes sollten:
- ✅ Nur HTTP-Handling haben
- ✅ Services aufrufen (nicht Repositories direkt!)
- ✅ HTTP-Statuscodes korrekt setzen
- ✅ Minimal sein (< 100 Zeilen)

## Beispiel: Kompletter Flow

### Create Member Request

```
POST /api/mitglieder
{
  "vorname": "Max",
  "nachname": "Mustermann",
  "email": "max@example.com"
}
```

**1. Route** (Controller)
```javascript
router.post('/', authenticateToken, async (req, res) => {
  try {
    const member = await MemberService.createMember(req.body, req.dojo_id);
    res.status(201).json(member);
  } catch (error) {
    if (error.message.includes('bereits')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});
```

**2. Service** (Business Logic)
```javascript
async createMember(data, dojoId) {
  // Validierung
  if (!data.vorname || !data.nachname || !data.email) {
    throw new Error('Pflichtfelder fehlen');
  }

  // Business Rule
  const existing = await memberRepository.findByEmail(data.email, dojoId);
  if (existing) {
    throw new Error('Email bereits vergeben');
  }

  // Daten vorbereiten
  const memberData = {
    ...data,
    status: 'aktiv',
    created_at: new Date(),
  };

  // Erstellen
  const member = await memberRepository.create(memberData, dojoId);

  // Event loggen
  logger.info('Member created', { memberId: member.id, dojoId });

  // Optional: Weitere Aktionen (z.B. Welcome-Email senden)
  // await notificationService.sendWelcomeEmail(member);

  return member;
}
```

**3. Repository** (Data Access)
```javascript
async create(data, dojoId) {
  if (dojoId && !data.dojo_id) {
    data.dojo_id = dojoId;
  }

  const query = 'INSERT INTO mitglieder SET ?';
  const results = await this.query(query, data);
  
  return { id: results.insertId, ...data };
}
```

## Performance-Vorteile

### Optimierte Queries
```javascript
// Repository kann optimierte Queries verwenden
async findByIdWithDetails(id, dojoId) {
  // JOIN statt N+1 Queries!
  const query = `
    SELECT 
      m.*,
      s.name as stil_name,
      g.name as guertel_name
    FROM mitglieder m
    LEFT JOIN stile s ON m.stil_id = s.id
    LEFT JOIN guertel g ON m.graduierung_id = g.id
    WHERE m.id = ? AND m.dojo_id = ?
  `;
  
  const results = await this.query(query, [id, dojoId]);
  return results[0];
}
```

### Caching (Optional)
```javascript
// Service kann Caching hinzufügen
const cache = {};

async getMemberById(id, dojoId) {
  const cacheKey = `member:${id}:${dojoId}`;
  
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }
  
  const member = await memberRepository.findById(id, dojoId);
  cache[cacheKey] = member;
  
  return member;
}
```

## Nächste Schritte

1. ✅ Migriere `mitglieder.js` (Template vorhanden)
2. Migriere `vertraege.js`
3. Migriere `pruefungen.js`
4. Migriere `transaktionen.js`
5. Schreibe Tests für Services
6. Refactor andere große Route-Dateien

## Template Repository

```bash
# Kopiere Template
cp repositories/MemberRepository.js repositories/NewRepository.js

# Anpassen:
# - Table name
# - Custom queries
# - Spezifische Methoden
```

## Template Service

```bash
# Kopiere Template
cp services/MemberService.js services/NewService.js

# Anpassen:
# - Business-Logik
# - Validierungen
# - Event-Logging
```
