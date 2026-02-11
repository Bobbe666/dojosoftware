#!/bin/bash
# ============================================================================
# DojoSoftware - Automatisches Datenbank-Backup
# Erstellt: 2026-01-26
# ============================================================================
#
# Funktionen:
# - Tägliches MySQL-Backup mit Kompression
# - Rotation: 7 Tage, 4 Wochen, 12 Monate
# - Logging aller Aktionen
# - Fehlerbenachrichtigung (optional)
#
# Cron-Job (0:01 Uhr täglich):
# 1 0 * * * /var/www/dojosoftware/scripts/backup-database.sh >> /var/log/dojo-backup.log 2>&1
#
# ============================================================================

# Konfiguration
BACKUP_DIR="/var/www/dojosoftware/backups/database"
LOG_FILE="/var/log/dojo-backup.log"
DATE=$(date +%Y-%m-%d)
DATETIME=$(date +%Y-%m-%d_%H-%M-%S)
DAY_OF_WEEK=$(date +%u)  # 1=Montag, 7=Sonntag
DAY_OF_MONTH=$(date +%d)

# Datenbank-Konfiguration (aus .env oder direkt)
DB_HOST="localhost"
DB_NAME="dojo"
DB_USER="root"
# DB_PASSWORD wird aus ~/.my.cnf oder Environment gelesen

# Rotation-Einstellungen
KEEP_DAILY=7      # Tägliche Backups behalten
KEEP_WEEKLY=4     # Wöchentliche Backups behalten (Sonntags)
KEEP_MONTHLY=12   # Monatliche Backups behalten (1. des Monats)

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Funktionen
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}✗ $1${NC}"
}

log_warning() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}⚠ $1${NC}"
}

# Verzeichnisse erstellen
setup_directories() {
    mkdir -p "$BACKUP_DIR/daily"
    mkdir -p "$BACKUP_DIR/weekly"
    mkdir -p "$BACKUP_DIR/monthly"
    log "Backup-Verzeichnisse geprüft"
}

# Datenbank-Backup erstellen
create_backup() {
    local backup_type=$1
    local backup_file="$BACKUP_DIR/$backup_type/dojo_${backup_type}_${DATETIME}.sql.gz"

    log "Starte $backup_type Backup nach: $backup_file"

    # MySQL-Dump mit allen wichtigen Optionen
    mysqldump \
        --host="$DB_HOST" \
        --user="$DB_USER" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --add-drop-table \
        --complete-insert \
        --extended-insert \
        --quick \
        "$DB_NAME" 2>/dev/null | gzip > "$backup_file"

    local exit_code=$?

    if [ $exit_code -eq 0 ] && [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log_success "$backup_type Backup erstellt: $(basename $backup_file) ($size)"
        # Rückgabe des Dateipfads über globale Variable
        LAST_BACKUP_FILE="$backup_file"
        return 0
    else
        log_error "Backup fehlgeschlagen! (Exit code: $exit_code)"
        return 1
    fi
}

# Alte Backups rotieren
rotate_backups() {
    local backup_type=$1
    local keep_count=$2
    local backup_path="$BACKUP_DIR/$backup_type"

    # Anzahl der vorhandenen Backups
    local count=$(ls -1 "$backup_path"/*.sql.gz 2>/dev/null | wc -l)

    if [ "$count" -gt "$keep_count" ]; then
        local to_delete=$((count - keep_count))
        log "Rotiere $backup_type Backups: Lösche $to_delete alte Backups..."

        # Älteste Backups löschen
        ls -1t "$backup_path"/*.sql.gz 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            log "Gelöscht: $(basename $file)"
        done
    fi
}

# Backup-Statistiken
show_stats() {
    log "=== Backup-Statistiken ==="

    for type in daily weekly monthly; do
        local path="$BACKUP_DIR/$type"
        if [ -d "$path" ]; then
            local count=$(ls -1 "$path"/*.sql.gz 2>/dev/null | wc -l)
            local size=$(du -sh "$path" 2>/dev/null | cut -f1)
            log "$type: $count Backups, $size Speicher"
        fi
    done

    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log "Gesamt: $total_size"
}

# Backup verifizieren
verify_backup() {
    local backup_file=$1

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "Backup-Datei nicht gefunden: $backup_file"
        return 1
    fi

    # Prüfe ob gzip-Datei gültig ist
    if gzip -t "$backup_file" 2>/dev/null; then
        # Prüfe Mindestgröße (sollte > 1KB sein) - Linux-kompatibel
        local size=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null)
        if [ "$size" -gt 1024 ]; then
            log_success "Backup verifiziert: $(basename $backup_file) ($(numfmt --to=iec $size 2>/dev/null || echo $size bytes))"
            return 0
        else
            log_error "Backup zu klein: $size Bytes"
            return 1
        fi
    else
        log_error "Backup-Datei ist korrupt!"
        return 1
    fi
}

# ============================================================================
# Hauptprogramm
# ============================================================================

main() {
    log "=========================================="
    log "DojoSoftware Backup gestartet"
    log "=========================================="

    # Verzeichnisse vorbereiten
    setup_directories

    # Globale Variable für letzten Backup-Pfad
    LAST_BACKUP_FILE=""

    # Tägliches Backup (immer)
    if create_backup "daily"; then
        verify_backup "$LAST_BACKUP_FILE"
    fi
    rotate_backups "daily" $KEEP_DAILY

    # Wöchentliches Backup (Sonntags)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        log "Sonntag - Erstelle wöchentliches Backup..."
        if create_backup "weekly"; then
            verify_backup "$LAST_BACKUP_FILE"
        fi
        rotate_backups "weekly" $KEEP_WEEKLY
    fi

    # Monatliches Backup (1. des Monats)
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        log "Monatsanfang - Erstelle monatliches Backup..."
        if create_backup "monthly"; then
            verify_backup "$LAST_BACKUP_FILE"
        fi
        rotate_backups "monthly" $KEEP_MONTHLY
    fi

    # Statistiken anzeigen
    show_stats

    log_success "Backup abgeschlossen!"
    log "=========================================="
}

# Skript ausführen
main "$@"
