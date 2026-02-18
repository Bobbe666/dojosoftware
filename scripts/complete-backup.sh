#!/bin/bash
# ============================================================================
# DojoSoftware - Vollständiges Backup-System (Datenbank + Code)
# Erstellt: 2026-02-18
# ============================================================================
#
# Funktionen:
# - Tägliches MySQL-Backup mit Kompression
# - Tägliches Code-Backup (alle Quellcode-Verzeichnisse)
# - Rotation: 7 Tage, 4 Wochen, 12 Monate
# - Logging aller Aktionen
# - Fehlerbenachrichtigung
#
# Cron-Job (0:30 Uhr täglich):
# 30 0 * * * /var/www/dojosoftware/scripts/complete-backup.sh >> /var/log/dojo-complete-backup.log 2>&1
#
# ============================================================================

# Konfiguration
BACKUP_BASE_DIR="/var/www/dojosoftware/backups"
DB_BACKUP_DIR="$BACKUP_BASE_DIR/database"
CODE_BACKUP_DIR="$BACKUP_BASE_DIR/code"
LOG_FILE="/var/log/dojo-complete-backup.log"
DATE=$(date +%Y-%m-%d)
DATETIME=$(date +%Y-%m-%d_%H-%M-%S)
DAY_OF_WEEK=$(date +%u)  # 1=Montag, 7=Sonntag
DAY_OF_MONTH=$(date +%d)

# Datenbank-Konfiguration
DB_HOST="localhost"
DB_NAME="dojo"
DB_USER="root"

# Code-Verzeichnisse für Backup
CODE_DIRS=(
    "/var/www/dojosoftware/frontend"
    "/var/www/dojosoftware/backend"
    "/var/www/tdasoftware/frontend"
    "/var/www/tdasoftware/backend"
    "/var/www/tda-events-source"
)

# Rotation-Einstellungen
KEEP_DAILY=7      # Tägliche Backups behalten
KEEP_WEEKLY=4     # Wöchentliche Backups behalten (Sonntags)
KEEP_MONTHLY=12   # Monatliche Backups behalten (1. des Monats)

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Funktionen
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${BLUE}ℹ $1${NC}" | tee -a "$LOG_FILE"
}

# Verzeichnisse erstellen
setup_directories() {
    mkdir -p "$DB_BACKUP_DIR/daily"
    mkdir -p "$DB_BACKUP_DIR/weekly"
    mkdir -p "$DB_BACKUP_DIR/monthly"
    mkdir -p "$CODE_BACKUP_DIR/daily"
    mkdir -p "$CODE_BACKUP_DIR/weekly"
    mkdir -p "$CODE_BACKUP_DIR/monthly"
    log "Backup-Verzeichnisse geprüft"
}

# Datenbank-Backup erstellen
create_database_backup() {
    local backup_type=$1
    local backup_file="$DB_BACKUP_DIR/$backup_type/dojo_${backup_type}_${DATETIME}.sql.gz"

    log "Starte $backup_type Datenbank-Backup..."

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
        log_success "Datenbank-Backup erstellt: $(basename $backup_file) ($size)"
        verify_backup "$backup_file"
        return 0
    else
        log_error "Datenbank-Backup fehlgeschlagen! (Exit code: $exit_code)"
        return 1
    fi
}

# Code-Backup erstellen
create_code_backup() {
    local backup_type=$1
    local backup_file="$CODE_BACKUP_DIR/$backup_type/code_${backup_type}_${DATETIME}.tar.gz"

    log "Starte $backup_type Code-Backup..."

    # tar mit Kompression erstellen, node_modules und andere große Verzeichnisse ausschließen
    tar -czf "$backup_file" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='dist.bak' \
        --exclude='build' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='*.tar.gz' \
        --exclude='*.zip' \
        --exclude='backups' \
        -C / \
        $(printf "var/www/dojosoftware/frontend ") \
        $(printf "var/www/dojosoftware/backend ") \
        $(printf "var/www/tdasoftware/frontend ") \
        $(printf "var/www/tdasoftware/backend ") \
        $(printf "var/www/tda-events-source ") \
        2>/dev/null

    local exit_code=$?

    if [ $exit_code -eq 0 ] && [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log_success "Code-Backup erstellt: $(basename $backup_file) ($size)"
        return 0
    else
        log_error "Code-Backup fehlgeschlagen! (Exit code: $exit_code)"
        return 1
    fi
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
        local size=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null)
        if [ "$size" -gt 1024 ]; then
            log_info "Backup verifiziert: $(basename $backup_file)"
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

# Alte Backups rotieren
rotate_backups() {
    local backup_dir=$1
    local backup_type=$2
    local keep_count=$3
    local backup_path="$backup_dir/$backup_type"

    # Anzahl der vorhandenen Backups
    local count=$(ls -1 "$backup_path"/*.{sql.gz,tar.gz} 2>/dev/null | wc -l)

    if [ "$count" -gt "$keep_count" ]; then
        local to_delete=$((count - keep_count))
        log "Rotiere $backup_type Backups in $(basename $backup_dir): Lösche $to_delete alte Backups..."

        # Älteste Backups löschen
        ls -1t "$backup_path"/*.{sql.gz,tar.gz} 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            log "Gelöscht: $(basename $file)"
        done
    fi
}

# Backup-Statistiken
show_stats() {
    log "=== Backup-Statistiken ==="

    log_info "Datenbank-Backups:"
    for type in daily weekly monthly; do
        local path="$DB_BACKUP_DIR/$type"
        if [ -d "$path" ]; then
            local count=$(ls -1 "$path"/*.sql.gz 2>/dev/null | wc -l)
            local size=$(du -sh "$path" 2>/dev/null | cut -f1)
            log "  $type: $count Backups, $size"
        fi
    done

    log_info "Code-Backups:"
    for type in daily weekly monthly; do
        local path="$CODE_BACKUP_DIR/$type"
        if [ -d "$path" ]; then
            local count=$(ls -1 "$path"/*.tar.gz 2>/dev/null | wc -l)
            local size=$(du -sh "$path" 2>/dev/null | cut -f1)
            log "  $type: $count Backups, $size"
        fi
    done

    local total_size=$(du -sh "$BACKUP_BASE_DIR" 2>/dev/null | cut -f1)
    log_info "Gesamt-Speicherverbrauch: $total_size"
}

# ============================================================================
# Hauptprogramm
# ============================================================================

main() {
    log "=========================================="
    log "DojoSoftware VOLLSTÄNDIGES Backup gestartet"
    log "=========================================="

    # Verzeichnisse vorbereiten
    setup_directories

    # ====================
    # DATENBANK-BACKUPS
    # ====================

    # Tägliches DB-Backup (immer)
    create_database_backup "daily"
    rotate_backups "$DB_BACKUP_DIR" "daily" $KEEP_DAILY

    # Wöchentliches DB-Backup (Sonntags)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        log_info "Sonntag - Erstelle wöchentliches Datenbank-Backup..."
        create_database_backup "weekly"
        rotate_backups "$DB_BACKUP_DIR" "weekly" $KEEP_WEEKLY
    fi

    # Monatliches DB-Backup (1. des Monats)
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        log_info "Monatsanfang - Erstelle monatliches Datenbank-Backup..."
        create_database_backup "monthly"
        rotate_backups "$DB_BACKUP_DIR" "monthly" $KEEP_MONTHLY
    fi

    # ====================
    # CODE-BACKUPS
    # ====================

    # Tägliches Code-Backup (immer)
    create_code_backup "daily"
    rotate_backups "$CODE_BACKUP_DIR" "daily" $KEEP_DAILY

    # Wöchentliches Code-Backup (Sonntags)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        log_info "Sonntag - Erstelle wöchentliches Code-Backup..."
        create_code_backup "weekly"
        rotate_backups "$CODE_BACKUP_DIR" "weekly" $KEEP_WEEKLY
    fi

    # Monatliches Code-Backup (1. des Monats)
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        log_info "Monatsanfang - Erstelle monatliches Code-Backup..."
        create_code_backup "monthly"
        rotate_backups "$CODE_BACKUP_DIR" "monthly" $KEEP_MONTHLY
    fi

    # Statistiken anzeigen
    show_stats

    log_success "Vollständiges Backup abgeschlossen!"
    log "=========================================="
}

# Skript ausführen
main "$@"
