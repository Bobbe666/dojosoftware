# Migration: Prüfungswartezeiten für Stile

## Beschreibung
Diese Migration fügt neue Felder zur `stile`-Tabelle hinzu, um standardmäßige Wartezeiten für Gürtelprüfungen zu verwalten.

## Neue Felder

### 1. `wartezeit_grundstufe` (INT)
- **Typ**: Integer
- **Standard**: 3
- **Beschreibung**: Wartezeit in Monaten für Grundstufen-Prüfungen (Weiß-, Gelb-, Orangegurt)

### 2. `wartezeit_mittelstufe` (INT)
- **Typ**: Integer
- **Standard**: 4
- **Beschreibung**: Wartezeit in Monaten für Mittelstufen-Prüfungen (Grün-, Blaugurt)

### 3. `wartezeit_oberstufe` (INT)
- **Typ**: Integer
- **Standard**: 6
- **Beschreibung**: Wartezeit in Monaten für Oberstufen-Prüfungen (Rot-, Braungurt)

### 4. `wartezeit_schwarzgurt_traditionell` (BOOLEAN)
- **Typ**: Boolean
- **Standard**: FALSE
- **Beschreibung**: Aktiviert traditionelle DAN-Wartezeiten:
  - 1. DAN → 2. DAN: 2 Jahre
  - 2. DAN → 3. DAN: 3 Jahre
  - 3. DAN → 4. DAN: 4 Jahre
  - usw. (DAN-Stufe = Jahre Wartezeit)

## Migration ausführen

### Option 1: Node.js Script (Empfohlen)
```bash
cd backend
node migrations/run_add_pruefungswartezeiten.js
```

### Option 2: MySQL direkt
```bash
mysql -u root -p dojo < migrations/add_pruefungswartezeiten_to_stile.sql
```

### Option 3: phpMyAdmin / Adminer
1. Öffne phpMyAdmin oder Adminer
2. Wähle die Datenbank `dojo`
3. Öffne den SQL-Tab
4. Füge den Inhalt von `add_pruefungswartezeiten_to_stile.sql` ein
5. Führe die Query aus

## Überprüfung
Nach der Migration kannst du überprüfen, ob die Felder hinzugefügt wurden:

```sql
DESCRIBE stile;
```

Du solltest die vier neuen Felder sehen:
- `wartezeit_grundstufe`
- `wartezeit_mittelstufe`
- `wartezeit_oberstufe`
- `wartezeit_schwarzgurt_traditionell`

## Verwendung im Frontend

Nach erfolgreicher Migration:
1. Öffne die Stilverwaltung
2. Wähle einen Stil aus
3. Navigiere zum Tab "⏱️ Prüfungseinstellungen"
4. Konfiguriere die Wartezeiten für verschiedene Stufen
5. Aktiviere optional die traditionelle Schwarzgurt-Regelung
6. Speichere die Einstellungen

## Troubleshooting

### Problem: Migration schlägt fehl mit "Access denied"
**Lösung**: Überprüfe die Datenbank-Anmeldedaten in `backend/.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=dein_passwort
DB_NAME=dojo
```

### Problem: Felder existieren bereits
**Lösung**: Die Migration prüft automatisch, ob die Felder existieren. Wenn sie bereits vorhanden sind, wird die Migration übersprungen.

### Problem: "Unknown database 'dojo'"
**Lösung**: Stelle sicher, dass die Datenbank `dojo` existiert. Falls nicht:
```sql
CREATE DATABASE dojo;
```

## Rollback (falls nötig)

Falls du die Migration rückgängig machen möchtest:

```sql
ALTER TABLE stile
  DROP COLUMN wartezeit_grundstufe,
  DROP COLUMN wartezeit_mittelstufe,
  DROP COLUMN wartezeit_oberstufe,
  DROP COLUMN wartezeit_schwarzgurt_traditionell;
```

## Support
Bei Fragen oder Problemen, kontaktiere das Entwicklungsteam.
