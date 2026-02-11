#!/bin/bash
# ============================================================================
# DojoSoftware - Datenbank-Wiederherstellung
# ============================================================================
#
# Verwendung:
#   ./restore-database.sh                    # Zeigt verfügbare Backups
#   ./restore-database.sh <backup-datei>     # Stellt Backup wieder her
#
# ============================================================================

set -e

BACKUP_DIR="/var/www/dojosoftware/backups/database"
DB_HOST="localhost"
DB_NAME="dojo"
DB_USER="root"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] $1"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

# Verfügbare Backups auflisten
list_backups() {
    echo -e "\n${CYAN}=== Verfügbare Backups ===${NC}\n"

    for type in daily weekly monthly; do
        echo -e "${YELLOW}[$type]${NC}"
        if [ -d "$BACKUP_DIR/$type" ]; then
            ls -lh "$BACKUP_DIR/$type"/*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'  || echo "  (keine)"
        fi
        echo ""
    done
}

# Backup wiederherstellen
restore_backup() {
    local backup_file=$1

    # Prüfe ob Datei existiert
    if [ ! -f "$backup_file" ]; then
        # Vielleicht relativer Pfad?
        if [ -f "$BACKUP_DIR/$backup_file" ]; then
            backup_file="$BACKUP_DIR/$backup_file"
        else
            log_error "Backup-Datei nicht gefunden: $backup_file"
            exit 1
        fi
    fi

    echo -e "\n${YELLOW}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║          DATENBANK-WIEDERHERSTELLUNG           ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════╝${NC}\n"

    echo -e "Backup-Datei: ${CYAN}$backup_file${NC}"
    echo -e "Ziel-Datenbank: ${CYAN}$DB_NAME${NC}"
    echo ""

    # Warnung
    log_warning "ACHTUNG: Die aktuelle Datenbank wird ÜBERSCHRIEBEN!"
    echo ""
    read -p "Sind Sie sicher? (ja/NEIN): " confirm

    if [ "$confirm" != "ja" ]; then
        log "Wiederherstellung abgebrochen."
        exit 0
    fi

    # Backup der aktuellen DB vor Restore
    log "Erstelle Sicherung der aktuellen Datenbank..."
    local pre_restore_backup="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
    mysqldump --host="$DB_HOST" --user="$DB_USER" --single-transaction "$DB_NAME" 2>/dev/null | gzip > "$pre_restore_backup"
    log_success "Sicherung erstellt: $pre_restore_backup"

    # Restore durchführen
    log "Stelle Datenbank wieder her..."
    gunzip -c "$backup_file" | mysql --host="$DB_HOST" --user="$DB_USER" "$DB_NAME"

    if [ $? -eq 0 ]; then
        log_success "Datenbank erfolgreich wiederhergestellt!"
        echo ""
        log "Pre-Restore Backup verfügbar unter: $pre_restore_backup"
    else
        log_error "Wiederherstellung fehlgeschlagen!"
        exit 1
    fi
}

# Hauptprogramm
if [ $# -eq 0 ]; then
    list_backups
    echo -e "Verwendung: ${CYAN}$0 <backup-datei>${NC}"
    echo ""
else
    restore_backup "$1"
fi
