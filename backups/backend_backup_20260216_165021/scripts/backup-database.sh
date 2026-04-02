#!/bin/bash

# =====================================================================================
# Automatisches Datenbank-Backup Script
# =====================================================================================
# Dieses Script erstellt ein vollständiges Backup der MySQL Datenbank
# und speichert es mit Datum/Zeitstempel
#
# Verwendung: ./backup-database.sh
# Crontab:    0 2 * * * /path/to/backup-database.sh >> /var/log/dojo-backup.log 2>&1
# =====================================================================================

# SECURITY: Lade Umgebungsvariablen aus .env falls vorhanden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [ -f "$ENV_FILE" ]; then
    export $(grep -E '^DB_(HOST|USER|PASSWORD|NAME)=' "$ENV_FILE" | xargs)
fi

# Konfiguration aus Umgebungsvariablen (sicher, kein Passwort im Script!)
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-dojo}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD}"  # MUSS in .env oder Umgebung gesetzt sein!

# Backup-Verzeichnis
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dojo}"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dojo_backup_${DATE}.sql"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Prüfe ob Passwort gesetzt ist
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ FEHLER: DB_PASSWORD nicht gesetzt! Bitte in .env oder Umgebungsvariable setzen."
    exit 1
fi

# Erstelle Backup-Verzeichnis falls es nicht existiert
mkdir -p ${BACKUP_DIR}

# Log-Start
echo "==================================================================" >> ${LOG_FILE}
echo "Backup gestartet: $(date)" >> ${LOG_FILE}

# Erstelle Backup (mit Host-Option für Remote-DBs)
mysqldump -h ${DB_HOST} -u ${DB_USER} -p${DB_PASSWORD} --single-transaction --routines --triggers ${DB_NAME} > ${BACKUP_FILE}

# Prüfe ob Backup erfolgreich war
if [ $? -eq 0 ]; then
    echo "✅ Backup erfolgreich erstellt: ${BACKUP_FILE}" >> ${LOG_FILE}

    # Komprimiere Backup
    gzip ${BACKUP_FILE}
    echo "✅ Backup komprimiert: ${BACKUP_FILE}.gz" >> ${LOG_FILE}

    # Lösche Backups älter als X Tage (Standard: 30)
    find ${BACKUP_DIR} -name "dojo_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    echo "🗑️ Alte Backups (>${RETENTION_DAYS} Tage) gelöscht" >> ${LOG_FILE}

    # Zeige Backup-Größe
    BACKUP_SIZE=$(du -h ${BACKUP_FILE}.gz | cut -f1)
    echo "📦 Backup-Größe: ${BACKUP_SIZE}" >> ${LOG_FILE}
else
    echo "❌ FEHLER: Backup fehlgeschlagen!" >> ${LOG_FILE}
    exit 1
fi

echo "Backup beendet: $(date)" >> ${LOG_FILE}
echo "==================================================================" >> ${LOG_FILE}

exit 0
