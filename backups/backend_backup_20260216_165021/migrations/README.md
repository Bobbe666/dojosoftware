# Database Migrations

## Performance Indexes

Die Datei `add_performance_indexes.sql` enthält wichtige Indizes zur Verbesserung der Query-Performance.

### Ausführung

**Wichtig: Erstelle IMMER ein Backup vor der Ausführung!**

```bash
# Backup erstellen
mysqldump -u dojoUser -p dojo > backup_before_indexes_$(date +%Y%m%d).sql

# Indizes erstellen
mysql -u dojoUser -p dojo < migrations/add_performance_indexes.sql
```

### Alternative: Über Node.js Script

```bash
# Führt Migration automatisch aus
node migrations/run_migration.js
```

### Erwartete Verbesserungen

Nach dem Anlegen der Indizes sollten folgende Queries deutlich schneller sein:

- **Mitglieder-Liste** (gefiltert nach Dojo): ~80% schneller
- **Vertrags-Abfragen**: ~70% schneller
- **Transaktions-Reports**: ~85% schneller
- **Anwesenheits-Statistiken**: ~75% schneller
- **Dashboard-Laden**: ~60% schneller

### Index-Größe

Die Indizes benötigen ca. 50-200 MB zusätzlichen Speicherplatz (abhängig von Datenmenge).

### Rollback

Falls Probleme auftreten:

```sql
DROP INDEX idx_mitglieder_dojo_id ON mitglieder;
DROP INDEX idx_mitglieder_email ON mitglieder;
-- etc. (siehe add_performance_indexes.sql für alle Index-Namen)
```

Oder:

```bash
# Backup wiederherstellen
mysql -u dojoUser -p dojo < backup_before_indexes_YYYYMMDD.sql
```
