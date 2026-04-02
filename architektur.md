# Architektur & kritische Bugs

## Stack

- **Frontend:** React 18 + Vite, kein TypeScript
- **Backend:** Node.js + Express, Port 5001
- **Datenbank:** MySQL (mysql2-Pool via `db.js`)
- **Auth:** JWT, Key `dojo_auth_token` im localStorage
- **Push:** VAPID-Keys in `.env` auf Server
- **WebSocket:** Socket.io auf Port 5001 (`/socket.io`)

## Multi-Tenant Architektur

```
Super-Admin: dojo_id = null im JWT
             → liest dojo_id aus ?dojo_id=X Query-Param
             → getSecureDojoId(req) aus tenantSecurity.js

Dojo-Admin:  dojo_id = X im JWT
             → sieht nur eigene Daten
```

Frontend `withDojo()` Helper:
```js
(url) => activeDojo?.id
  ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}`
  : url
```

Wenn Super-Admin `activeDojo === 'super-admin'` (String):
- `activeDojo?.id === undefined`
- `useEffect` mit `if (activeDojo?.id)` wird nie triggered
- Fix: `if (activeDojo)` verwenden

## Feature-Flags (Subscription-Pläne)

Tabellen: `dojo_subscriptions`, `subscription_plans`

| Feature-Key | Spalte | Ab Plan |
|-------------|--------|---------|
| `verkauf` | `feature_verkauf` | Premium |
| `buchfuehrung` | `feature_buchfuehrung` | Premium |
| `events` | `feature_events` | Premium |
| `multidojo` | `feature_multidojo` | Enterprise |
| `api` | `feature_api` | Enterprise |
| `kontoauszug` | `feature_kontoauszug` | Enterprise |

Backend-Middleware: `requireFeature('kontoauszug')` aus `middleware/featureAccess.js`
Frontend: `const { hasFeature } = useSubscription(); hasFeature('kontoauszug')`

## Bekannte kritische Bugs

### Doppeltes /api (häufigster Bug)
Axios hat `baseURL: '/api'`. Kein `/api/`-Prefix in Axios-Calls verwenden.
Falsch: `axios.get('/api/buchhaltung/...')` → landet bei `/api/api/buchhaltung/...`

### PM2-Neustart vergessen
Nach JEDEM Backend-Deploy: `pm2 restart dojosoftware-backend`
Node.js cached require'd Files — ohne Neustart läuft alter Code.

### mitglieder.js vs mitglieder/-Verzeichnis
Node.js lädt `mitglieder.js` (Datei) vor `mitglieder/index.js`.
Server nutzt die 185-KB-Monolithdate — neue Routen dort eintragen!

### Route-Reihenfolge
`router.get('/:id', ...)` fängt ALLES ab.
Statische Routen (`/stats/dashboard`) VOR `/:id` definieren.

### TDZ in React-Komponenten (Vite Prod-Build)
```js
// FALSCH: useEffect referenziert loadDojos bevor es deklariert ist
useEffect(() => { loadDojos(); }, [loadDojos]);
const loadDojos = useCallback(...);  // zu spät!

// RICHTIG: loadDojos VOR dem useEffect deklarieren
const loadDojos = useCallback(...);
useEffect(() => { loadDojos(); }, [loadDojos]);
```
Vite-Prod-Build minifiziert Namen → TDZ-Fehler erscheinen als "Cannot access 'u' before initialization".

### React Fehler #31 (Objekt als JSX-Child)
Im catch-Block immer:
```js
typeof msg === 'string' ? msg : JSON.stringify(msg)
```

### activeDojo String-Mode
Super-Admin: `activeDojo === 'super-admin'` (String, nicht Objekt).
`activeDojo?.id` ist dann `undefined`. Prüfung: `if (activeDojo)` statt `if (activeDojo?.id)`.

## Datenbank

```
Host: localhost
DB-Name: dojo (Prod), dojo_test (lokal)
User: tdaUser@localhost
Connection: mysql2-Pool via db.js
Promise-Queries: const pool = db.promise()
```

Prod-DB lokal syncen: `./sync-db.sh` (anonymisiert → importiert in dojo_test)

## Chat / Messenger

- Tabellen: `chat_rooms`, `chat_room_members`, `chat_messages`, `chat_message_reads`, `chat_message_reactions`
- Socket.io auf Port 5001
- Facebook Messenger Integration: `messenger.js` Route
- Webhook: `https://dojo.tda-intl.org/api/messenger/webhook`

## Migrations

Nummeriert: `001_...sql` bis aktuell `072_add_kontoauszug_enterprise.sql`
Auf Server ausführen:
```bash
ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org \
  "mysql dojo < /dev/stdin" < backend/migrations/NNN_name.sql
```
