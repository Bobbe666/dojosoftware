# API-Dokumentation

## Wichtigste Regel: Kein doppeltes /api

Axios ist global mit `baseURL: '/api'` konfiguriert.
→ In Komponenten IMMER `/buchhaltung/...` schreiben, **nie** `/api/buchhaltung/...`
→ Sonst landet die URL bei `/api/api/buchhaltung/...` → 404

**Richtig:** `axios.get('/events/...')`, `axios.get('/buchhaltung/...')`
**Falsch:** `axios.get('/api/events/...')`

## Auth

Alle geschützten Routen erwarten:
```
Authorization: Bearer <token>
```
Token liegt im localStorage unter `dojo_auth_token`.

## Feature-Gates (Backend)

```js
const { requireFeature } = require('../middleware/featureAccess');

router.get('/mein-endpoint', requireFeature('kontoauszug'), requireBuchhaltungAccess, ...)
```

Feature-Keys: `verkauf` | `buchfuehrung` | `events` | `multidojo` | `api` | `kontoauszug`

## Haupt-Routen

| Prefix | Datei | Beschreibung |
|--------|-------|-------------|
| `/auth` | auth.js | Login, JWT |
| `/mitglieder` | mitglieder.js | Mitglieder (185 KB monolithisch!) |
| `/buchhaltung` | buchhaltung.js | EÜR, Kassenbuch, Bank-Import |
| `/euer` | euer.js | EÜR für Dojos (separater Router) |
| `/events` | events.js | TDA-Events |
| `/verkaeufe` | verkaeufe.js | Shop-Verkäufe |
| `/rechnungen` | rechnungen.js | Rechnungen |
| `/beitraege` | beitraege.js | Mitgliedsbeiträge |
| `/checkin` | checkin.js | Checkin-System |
| `/subscription` | dojos.js | Subscription-Status |

## Bank-Import Endpunkte (`/buchhaltung/bank-import/...`)

Alle erfordern Feature `kontoauszug` (Enterprise).

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/upload` | Kontoauszug hochladen (CSV/XLSX/MT940) |
| GET | `/transaktionen` | Transaktion-Liste |
| GET | `/statistik` | Unzugeordnet/Vorgeschlagen/Zugeordnet |
| POST | `/zuordnen/:id` | Transaktion manuell zuordnen |
| POST | `/batch-zuordnen` | Mehrere auf einmal |
| POST | `/vorschlag-annehmen/:id` | Auto-Match bestätigen |
| POST | `/ignorieren/:id` | Ignorieren |
| POST | `/umbuchen/:id` | Umbuchen |
| GET | `/offene-rechnungen` | Offene Rechnungen zum Abgleich |
| POST | `/rechnung-verknuepfen/:id` | Mit Rechnung verknüpfen |
| DELETE | `/transaktion/:id` | Löschen |
| DELETE | `/import/:importId` | Ganzen Import löschen |
| GET | `/historie` | Import-Historie |
| GET | `/steuerauswertung` | EÜR-Auswertung nach Kategorien |
| POST | `/euer-uebertragen` | Neue Transaktionen → EÜR-Belege |
| GET | `/abgleich-bericht` | Abgleich-Status je Transaktion |
| GET | `/cashflow` | Monatl. Cashflow + Kategorien |
| POST | `/rematch-all` | Alle offenen Tx neu abgleichen |
| GET | `/kategorien-vorschlag` | Auto-Kat für einzelne Tx |
| GET | `/kategorien-liste` | Alle Standard-Kategorien |

## Multi-Tenant

Super-Admin hat `dojo_id = null` im JWT.
- `getSecureDojoId(req)` aus `tenantSecurity.js` für alle Read-Ops
- Alle Write-Ops: `if (!dojoId) return res.status(400)` Guard
- Frontend: `withDojo(url)` Helper hängt `?dojo_id=X` an

## Route-Reihenfolge (wichtig!)

Statische Routen vor dynamischen:
```js
router.get('/stats/dashboard', ...)  // ZUERST
router.get('/:id', ...)               // DANACH
```

## Kritische Backend-Regel: mitglieder.js

Node.js lädt bei `require('./routes/mitglieder')` zuerst `mitglieder.js` (Datei),
dann `mitglieder/index.js`. Der Server nutzt die monolithische `mitglieder.js` (185 KB).
→ Neue Routen IMMER in `mitglieder.js` eintragen, nicht in `mitglieder/stile.js`!
