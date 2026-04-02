# Test Suite für DojoSoftware Backend

## Übersicht

Diese Test-Suite verwendet **Jest** und **Supertest** für Unit- und Integration-Tests.

## Struktur

```
tests/
├── setup.js              # Jest Setup (läuft vor allen Tests)
├── unit/                 # Unit Tests (isolierte Funktionen)
│   └── logger.test.js
├── integration/          # Integration Tests (API Endpoints)
│   └── auth.test.js
└── fixtures/             # Test-Daten (TODO)
    └── users.json
```

## Tests ausführen

### Alle Tests

```bash
npm test
```

### Mit Watch Mode (für Entwicklung)

```bash
npm run test:watch
```

### Nur Unit Tests

```bash
npm run test:unit
```

### Nur Integration Tests

```bash
npm run test:integration
```

### Mit Coverage Report

```bash
npm test
# Coverage Report wird in coverage/ erstellt
open coverage/lcov-report/index.html
```

## Test schreiben

### Unit Test Beispiel

```javascript
// tests/unit/myFunction.test.js
const myFunction = require('../../utils/myFunction');

describe('myFunction', () => {
  it('sollte X zurückgeben wenn Y übergeben wird', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Test Beispiel

```javascript
// tests/integration/myRoute.test.js
const request = require('supertest');
const app = require('../../server'); // oder Express App

describe('GET /api/my-endpoint', () => {
  it('sollte 200 und Daten zurückgeben', async () => {
    const response = await request(app)
      .get('/api/my-endpoint')
      .set('Authorization', 'Bearer ' + testHelpers.generateToken({ id: 1 }))
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
  });
});
```

## Test-Datenbank Setup

**WICHTIG:** Verwende NIEMALS die Production-Datenbank für Tests!

### Test-Datenbank erstellen

```sql
CREATE DATABASE dojo_test;
GRANT ALL PRIVILEGES ON dojo_test.* TO 'dojoUser'@'localhost';
```

### Schema kopieren

```bash
mysqldump -u dojoUser -p --no-data dojo | mysql -u dojoUser -p dojo_test
```

### Fixtures laden (TODO)

```bash
node tests/fixtures/load-fixtures.js
```

## Coverage Ziele

Aktuelle Mindest-Coverage (siehe jest.config.js):

- **Branches:** 50%
- **Functions:** 50%
- **Lines:** 50%
- **Statements:** 50%

Ziel für kritische Module:

- **Auth:** 80%+
- **Payments:** 90%+
- **Mitglieder CRUD:** 70%+

## Kontinuierliche Integration

### GitHub Actions (TODO)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
```

## Debugging Tests

### Einzelnen Test debuggen

```bash
node --inspect-brk node_modules/.bin/jest tests/unit/logger.test.js
```

### Mit VS Code

Füge zu `.vscode/launch.json` hinzu:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal"
}
```

## Best Practices

1. **Isoliere Tests:** Jeder Test sollte unabhängig sein
2. **Mock External Services:** Datenbank, APIs, etc.
3. **Beschreibende Namen:** Test-Namen sollten klar sein
4. **Arrange-Act-Assert:** Strukturiere Tests klar
5. **Teste Edge Cases:** Nicht nur Happy Path

## TODO

- [ ] Test-Datenbank Fixtures erstellen
- [ ] E2E Tests für kritische User Flows
- [ ] Performance Tests für große Datenmengen
- [ ] Security Tests (SQL Injection, XSS, etc.)
- [ ] CI/CD Pipeline Integration
- [ ] Code Coverage auf 70%+ erhöhen
