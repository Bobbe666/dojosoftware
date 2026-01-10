# Swagger/OpenAPI Documentation Guide

## Zugriff auf API-Dokumentation

Nach dem Server-Start ist die Swagger UI verfügbar unter:

```
http://localhost:5001/api-docs
```

## OpenAPI Spec als JSON

```
http://localhost:5001/api-docs.json
```

## Route dokumentieren

Füge JSDoc-Kommentare über deinen Route-Definitionen hinzu:

### Beispiel: GET Endpoint

```javascript
/**
 * @swagger
 * /mitglieder:
 *   get:
 *     summary: Hole alle Mitglieder
 *     tags: [Mitglieder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Seitennummer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Anzahl pro Seite
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Suchbegriff (Name, Email, etc.)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [aktiv, inaktiv, geloescht]
 *         description: Filter nach Status
 *     responses:
 *       200:
 *         description: Erfolgreich
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Mitglied'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung
 */
router.get('/', authenticateToken, async (req, res) => {
  // Route implementation
});
```

### Beispiel: POST Endpoint

```javascript
/**
 * @swagger
 * /mitglieder:
 *   post:
 *     summary: Erstelle neues Mitglied
 *     tags: [Mitglieder]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vorname
 *               - nachname
 *               - email
 *             properties:
 *               vorname:
 *                 type: string
 *                 example: Max
 *               nachname:
 *                 type: string
 *                 example: Mustermann
 *               email:
 *                 type: string
 *                 format: email
 *                 example: max@example.com
 *               mitgliedsnummer:
 *                 type: string
 *                 example: M-2024-001
 *               status:
 *                 type: string
 *                 enum: [aktiv, inaktiv]
 *                 default: aktiv
 *     responses:
 *       201:
 *         description: Erfolgreich erstellt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mitglied'
 *       400:
 *         description: Validierungsfehler
 *       409:
 *         description: Email bereits vergeben
 */
router.post('/', authenticateToken, async (req, res) => {
  // Route implementation
});
```

### Beispiel: PUT Endpoint

```javascript
/**
 * @swagger
 * /mitglieder/{id}:
 *   put:
 *     summary: Aktualisiere Mitglied
 *     tags: [Mitglieder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Mitglied ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Mitglied'
 *     responses:
 *       200:
 *         description: Erfolgreich aktualisiert
 *       404:
 *         description: Nicht gefunden
 *       403:
 *         description: Zugriff verweigert
 */
router.put('/:id', authenticateToken, async (req, res) => {
  // Route implementation
});
```

### Beispiel: DELETE Endpoint

```javascript
/**
 * @swagger
 * /mitglieder/{id}:
 *   delete:
 *     summary: Lösche Mitglied
 *     tags: [Mitglieder]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Mitglied ID
 *     responses:
 *       200:
 *         description: Erfolgreich gelöscht
 *       404:
 *         description: Nicht gefunden
 *       403:
 *         description: Zugriff verweigert
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  // Route implementation
});
```

## Schemas definieren

Wiederverwendbare Schemas in `swagger.js` definieren:

```javascript
components: {
  schemas: {
    Mitglied: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        vorname: { type: 'string' },
        nachname: { type: 'string' },
        email: { type: 'string', format: 'email' },
        status: {
          type: 'string',
          enum: ['aktiv', 'inaktiv', 'geloescht']
        },
      },
      required: ['vorname', 'nachname', 'email'],
    },
  },
}
```

## Tags organisieren

Gruppiere Endpoints mit Tags:

```javascript
/**
 * @swagger
 * tags:
 *   - name: Mitglieder
 *     description: Mitgliederverwaltung
 *   - name: Verträge
 *     description: Vertragsverwaltung
 *   - name: Prüfungen
 *     description: Prüfungsverwaltung
 */
```

## Authentication dokumentieren

Bereits in `swagger.js` konfiguriert:

```javascript
security: [
  {
    bearerAuth: [],
  },
],
```

## Best Practices

1. **Vollständige Beschreibungen**
   - Beschreibe jeden Endpoint klar
   - Erkläre Parameter und Body-Felder
   - Dokumentiere alle Response-Codes

2. **Beispiele hinzufügen**
   - Füge realistische Beispiel-Werte hinzu
   - Hilft Entwicklern beim Testen

3. **Schemas wiederverwenden**
   - Definiere Schemas zentral in `swagger.js`
   - Verwende `$ref` um Duplikate zu vermeiden

4. **Error Responses**
   - Dokumentiere alle möglichen Fehler
   - Konsistentes Error-Format verwenden

5. **Tags verwenden**
   - Gruppiere verwandte Endpoints
   - Erleichtert Navigation

## Swagger UI Features

### Try it out

Teste Endpoints direkt in der UI:
1. Klicke "Try it out"
2. Fülle Parameter aus
3. Klicke "Execute"
4. Sieh die Response

### Authorization

Authentifiziere dich:
1. Klicke "Authorize" Button
2. Gib Bearer Token ein
3. Alle Requests verwenden jetzt das Token

### Models/Schemas

Sieh alle definierten Schemas unter "Schemas" Section

## Migration Checkliste

Für jede Route-Datei:

- [ ] @swagger Kommentare hinzufügen
- [ ] Alle Endpoints dokumentieren
- [ ] Request/Response Schemas definieren
- [ ] Parameter beschreiben
- [ ] Error Codes dokumentieren
- [ ] Tags hinzufügen
- [ ] Beispiele hinzufügen
- [ ] In Swagger UI testen

## Automatische Validierung

Optional: Nutze `express-openapi-validator` für automatische Request-Validierung:

```bash
npm install express-openapi-validator
```

```javascript
const OpenApiValidator = require('express-openapi-validator');

app.use(
  OpenApiValidator.middleware({
    apiSpec: './swagger.js',
    validateRequests: true,
    validateResponses: true,
  }),
);
```

## CI/CD Integration

### Validiere OpenAPI Spec

```bash
npx @redocly/cli lint api-docs.json
```

### Generiere API Client

```bash
npx openapi-generator-cli generate -i api-docs.json -g javascript -o ./client
```

## Nächste Schritte

1. Dokumentiere kritische Routes zuerst (Auth, Mitglieder)
2. Füge zu allen Routes schrittweise hinzu
3. Teste in Swagger UI
4. Teile API-Docs mit Frontend-Team
