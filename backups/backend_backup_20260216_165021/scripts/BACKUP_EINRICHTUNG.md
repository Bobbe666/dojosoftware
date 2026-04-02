# Automatische Datensicherung einrichten

## Übersicht
Dieses Dokument beschreibt, wie Sie die automatische tägliche Datensicherung um 0:15 Uhr einrichten.

## Voraussetzungen
- SSH-Zugriff auf den Produktionsserver
- Root- oder sudo-Berechtigungen
- MySQL/MariaDB Datenbank

## Schritt 1: Backup-Script vorbereiten

1. **Script auf den Server hochladen:**
   ```bash
   scp backend/scripts/backup-database.sh root@ihr-server:/usr/local/bin/
   ```

2. **Ausführbar machen:**
   ```bash
   ssh root@ihr-server
   chmod +x /usr/local/bin/backup-database.sh
   ```

3. **Datenbank-Credentials konfigurieren:**
   ```bash
   nano /usr/local/bin/backup-database.sh
   ```

   Ändern Sie folgende Zeilen:
   ```bash
   DB_NAME="dojo"           # Name Ihrer Datenbank
   DB_USER="root"           # MySQL Benutzername
   DB_PASSWORD="HIER_PASSWORT"  # MySQL Passwort
   ```

## Schritt 2: Cron-Job einrichten

1. **Cron-Editor öffnen:**
   ```bash
   crontab -e
   ```

2. **Folgende Zeile hinzufügen:**
   ```cron
   15 0 * * * /usr/local/bin/backup-database.sh
   ```

   Dies führt das Backup täglich um 0:15 Uhr aus.

3. **Speichern und beenden** (STRG+O, dann STRG+X in nano)

## Schritt 3: Test durchführen

1. **Script manuell testen:**
   ```bash
   /usr/local/bin/backup-database.sh
   ```

2. **Backup-Verzeichnis prüfen:**
   ```bash
   ls -lh /var/backups/dojo/
   ```

3. **Log-Datei prüfen:**
   ```bash
   cat /var/backups/dojo/backup.log
   ```

## Schritt 4: Cron-Job verifizieren

1. **Aktive Cron-Jobs anzeigen:**
   ```bash
   crontab -l
   ```

2. **Cron-Log überwachen:**
   ```bash
   grep CRON /var/log/syslog | tail
   ```

## Erweiterte Konfiguration

### Backup auf externen Server kopieren (optional)

Fügen Sie am Ende von `backup-database.sh` hinzu:

```bash
# Backup auf externen Server kopieren
REMOTE_SERVER="backup@backup-server.de"
REMOTE_DIR="/backups/dojo"
scp ${BACKUP_FILE}.gz ${REMOTE_SERVER}:${REMOTE_DIR}/
```

### Email-Benachrichtigung bei Fehler (optional)

```bash
# Am Anfang des Scripts hinzufügen
ADMIN_EMAIL="admin@ihr-dojo.de"

# Bei Fehler (nach dem else):
echo "Backup fehlgeschlagen am $(date)" | mail -s "DOJO Backup FEHLER" ${ADMIN_EMAIL}
```

### Verschiedene Backup-Zeiten für verschiedene Server

```cron
# Tägliches Backup um 0:15 Uhr
15 0 * * * /usr/local/bin/backup-database.sh

# Wöchentliches vollständiges Backup (Sonntag 2:00 Uhr)
0 2 * * 0 /usr/local/bin/backup-database-full.sh

# Monatliches Archiv (1. des Monats, 3:00 Uhr)
0 3 1 * * /usr/local/bin/backup-database-monthly.sh
```

## Backup-Aufbewahrung

Das Script löscht automatisch Backups, die älter als 30 Tage sind.

Um dies anzupassen, ändern Sie in `backup-database.sh`:
```bash
find ${BACKUP_DIR} -name "dojo_backup_*.sql.gz" -mtime +30 -delete
#                                                         ^^
#                                                    Tage hier ändern
```

## Backup wiederherstellen

### Vollständige Wiederherstellung:

```bash
# Entpacken
gunzip /var/backups/dojo/dojo_backup_YYYYMMDD_HHMMSS.sql.gz

# Wiederherstellen
mysql -u root -p dojo < /var/backups/dojo/dojo_backup_YYYYMMDD_HHMMSS.sql
```

### Einzelne Tabelle wiederherstellen:

```bash
# Nur spezifische Tabelle extrahieren
sed -n '/CREATE TABLE `mitglieder`/,/UNLOCK TABLES/p' backup.sql > mitglieder.sql

# Einzelne Tabelle wiederherstellen
mysql -u root -p dojo < mitglieder.sql
```

## Troubleshooting

### Problem: "Access denied for user"
```bash
# MySQL Berechtigungen prüfen
mysql -u root -p
GRANT ALL PRIVILEGES ON dojo.* TO 'backup_user'@'localhost';
FLUSH PRIVILEGES;
```

### Problem: "Backup directory not writable"
```bash
# Berechtigungen setzen
sudo chown -R root:root /var/backups/dojo
sudo chmod 755 /var/backups/dojo
```

### Problem: Cron läuft nicht
```bash
# Cron-Dienst Status prüfen
systemctl status cron

# Cron-Dienst neu starten
systemctl restart cron
```

## Monitoring

### Backup-Statistiken anzeigen:
```bash
#!/bin/bash
echo "=== DOJO Backup Status ==="
echo "Letztes Backup:"
ls -lth /var/backups/dojo/dojo_backup_*.sql.gz | head -1
echo ""
echo "Anzahl Backups:"
ls /var/backups/dojo/dojo_backup_*.sql.gz | wc -l
echo ""
echo "Gesamtgröße:"
du -sh /var/backups/dojo/
echo ""
echo "Letzte 5 Log-Einträge:"
tail -5 /var/backups/dojo/backup.log
```

## Sicherheitshinweise

1. **Passwörter schützen**: Das Backup-Script enthält Datenbank-Passwörter
   ```bash
   chmod 700 /usr/local/bin/backup-database.sh
   ```

2. **Backup-Verzeichnis schützen**:
   ```bash
   chmod 700 /var/backups/dojo
   ```

3. **Externe Backups**: Kopieren Sie Backups auf einen externen Server oder Cloud-Speicher

4. **Verschlüsselung**: Für sensible Daten:
   ```bash
   # Nach dem gzip:
   openssl enc -aes-256-cbc -salt -in ${BACKUP_FILE}.gz -out ${BACKUP_FILE}.gz.enc -k IHR_PASSWORT
   ```

## Support

Bei Problemen:
1. Log-Datei prüfen: `/var/backups/dojo/backup.log`
2. Cron-Log prüfen: `/var/log/syslog`
3. Script manuell ausführen und Fehler beobachten
