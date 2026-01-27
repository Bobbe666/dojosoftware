#!/bin/bash

# =====================================================================================
# Automatisches Datenbank-Backup Script
# =====================================================================================
# Dieses Script erstellt ein vollständiges Backup der MySQL Datenbank
# und speichert es mit Datum/Zeitstempel
# =====================================================================================

# Konfiguration
DB_NAME="dojo"
DB_USER="root"
DB_PASSWORD="your_password_here"  # WICHTIG: Ändern Sie dies mit Ihrem echten Passwort
BACKUP_DIR="/var/backups/dojo"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dojo_backup_${DATE}.sql"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Erstelle Backup-Verzeichnis falls es nicht existiert
mkdir -p ${BACKUP_DIR}

# Log-Start
echo "==================================================================" >> ${LOG_FILE}
echo "Backup gestartet: $(date)" >> ${LOG_FILE}

# Erstelle Backup
mysqldump -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > ${BACKUP_FILE}

# Prüfe ob Backup erfolgreich war
if [ $? -eq 0 ]; then
    echo "✅ Backup erfolgreich erstellt: ${BACKUP_FILE}" >> ${LOG_FILE}

    # Komprimiere Backup
    gzip ${BACKUP_FILE}
    echo "✅ Backup komprimiert: ${BACKUP_FILE}.gz" >> ${LOG_FILE}

    # Lösche Backups älter als 30 Tage
    find ${BACKUP_DIR} -name "dojo_backup_*.sql.gz" -mtime +30 -delete
    echo "🗑️ Alte Backups (>30 Tage) gelöscht" >> ${LOG_FILE}

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
