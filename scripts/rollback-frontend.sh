#!/bin/bash
# =============================================================================
# FRONTEND ROLLBACK SCRIPT
# =============================================================================
# Stellt ein vorheriges Backup wieder her
# =============================================================================

set -e

# Konfiguration
SERVER="dojo.tda-intl.org"
REMOTE_PATH="/var/www/dojosoftware"
BACKUP_PATH="/var/www/backups/dojosoftware"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Prüfe Argument
if [ -z "$1" ]; then
    echo ""
    log_info "Verfügbare Backups:"
    echo ""
    ssh $SERVER "ls -lth $BACKUP_PATH/frontend_backup_*.tar.gz 2>/dev/null | head -10" || echo "Keine Backups gefunden"
    echo ""
    log_info "Verwendung: $0 <backup_name>"
    log_info "Beispiel: $0 frontend_backup_20260210_163000"
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_FILE="$BACKUP_PATH/${BACKUP_NAME}.tar.gz"

echo ""
echo "=============================================="
echo "  FRONTEND ROLLBACK"
echo "=============================================="
echo ""
log_warning "ACHTUNG: Dies wird das aktuelle Frontend überschreiben!"
log_info "Backup: $BACKUP_FILE"
echo ""

# Prüfe ob Backup existiert
BACKUP_EXISTS=$(ssh $SERVER "test -f $BACKUP_FILE && echo 'YES' || echo 'NO'")
if [ "$BACKUP_EXISTS" != "YES" ]; then
    log_error "Backup nicht gefunden: $BACKUP_FILE"
    exit 1
fi

# Bestätigung
read -p "Fortfahren? (ja/nein): " CONFIRM
if [ "$CONFIRM" != "ja" ]; then
    log_info "Abgebrochen."
    exit 0
fi

# Aktuellen Stand sichern
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
log_info "Sichere aktuellen Stand vor Rollback..."
ssh $SERVER "tar -czf $BACKUP_PATH/pre_rollback_${TIMESTAMP}.tar.gz \
    --exclude='backend' \
    --exclude='backend/*' \
    -C /var/www dojosoftware 2>/dev/null"

# Rollback durchführen (nur Frontend-Dateien)
log_info "Stelle Frontend aus Backup wieder her..."
ssh $SERVER "cd /var/www && \
    tar -xzf $BACKUP_FILE --exclude='dojosoftware/backend' --exclude='dojosoftware/backend/*' && \
    echo 'Rollback abgeschlossen'"

log_success "Rollback erfolgreich!"
log_info "Vorheriger Stand gesichert unter: pre_rollback_${TIMESTAMP}.tar.gz"
