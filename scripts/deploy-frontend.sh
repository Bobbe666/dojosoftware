#!/bin/bash
# =============================================================================
# SICHERES FRONTEND DEPLOYMENT SCRIPT
# =============================================================================
# Dieses Script:
# 1. Erstellt IMMER ein Backup vor dem Deployment
# 2. Deployed NUR Frontend-Dateien (Backend wird NIEMALS angefasst)
# 3. Kann bei Problemen ein Rollback durchführen
# =============================================================================

set -e  # Bei Fehlern sofort abbrechen

# Konfiguration
SERVER="dojo.tda-intl.org"
REMOTE_PATH="/var/www/dojosoftware/frontend/dist"
BACKUP_PATH="/var/www/backups/dojosoftware"
LOCAL_DIST="frontend/dist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funktionen
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Prüfe ob wir im richtigen Verzeichnis sind
cd "$PROJECT_ROOT"
if [ ! -d "$LOCAL_DIST" ]; then
    log_error "Frontend dist Verzeichnis nicht gefunden: $LOCAL_DIST"
    log_info "Bitte zuerst 'npm run build' im frontend Verzeichnis ausführen"
    exit 1
fi

# Timestamp für Backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="frontend_backup_${TIMESTAMP}"

echo ""
echo "=============================================="
echo "  SICHERES FRONTEND DEPLOYMENT"
echo "=============================================="
echo ""
log_info "Server: $SERVER"
log_info "Remote Path: $REMOTE_PATH"
log_info "Backup Name: $BACKUP_NAME"
echo ""

# SCHRITT 1: Backup erstellen
echo "----------------------------------------------"
log_info "SCHRITT 1: Erstelle Backup auf dem Server..."
echo "----------------------------------------------"

ssh $SERVER "mkdir -p $BACKUP_PATH && \
    echo 'Sichere Frontend-Dateien...' && \
    tar -czf $BACKUP_PATH/${BACKUP_NAME}.tar.gz \
        --exclude='backend' \
        --exclude='backend/*' \
        -C /var/www dojosoftware 2>/dev/null && \
    echo 'Backup erstellt: $BACKUP_PATH/${BACKUP_NAME}.tar.gz'"

if [ $? -ne 0 ]; then
    log_error "Backup fehlgeschlagen! Deployment abgebrochen."
    exit 1
fi
log_success "Backup erfolgreich erstellt"

# SCHRITT 2: Backend-Verzeichnis sichern (extra Sicherheit)
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 2: Prüfe Backend-Integrität..."
echo "----------------------------------------------"

BACKEND_CHECK=$(ssh $SERVER "ls -la /var/www/dojo-backend/server.js 2>/dev/null && echo 'OK' || echo 'MISSING'")
if [[ "$BACKEND_CHECK" == *"MISSING"* ]]; then
    log_error "Backend server.js nicht gefunden! Bitte manuell prüfen."
    exit 1
fi
log_success "Backend ist intakt"

# SCHRITT 3: Frontend deployen (OHNE --delete, OHNE backend)
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 3: Deploye Frontend-Dateien..."
echo "----------------------------------------------"

# WICHTIG: Wir listen explizit auf, was synchronisiert wird
# und schließen das backend-Verzeichnis aus
rsync -avz \
    --exclude='backend' \
    --exclude='backend/**' \
    --exclude='.git' \
    --exclude='.git/**' \
    --exclude='node_modules' \
    --exclude='node_modules/**' \
    "$LOCAL_DIST/" "$SERVER:$REMOTE_PATH/"

if [ $? -ne 0 ]; then
    log_error "Deployment fehlgeschlagen!"
    log_warning "Das Backup kann mit folgendem Befehl wiederhergestellt werden:"
    echo "  ssh $SERVER \"cd /var/www && tar -xzf $BACKUP_PATH/${BACKUP_NAME}.tar.gz\""
    exit 1
fi
log_success "Frontend erfolgreich deployed"

# SCHRITT 4: Verifiziere dass Backend noch intakt ist
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 4: Verifiziere Backend nach Deployment..."
echo "----------------------------------------------"

BACKEND_VERIFY=$(ssh $SERVER "ls -la /var/www/dojo-backend/server.js 2>/dev/null && echo 'OK' || echo 'MISSING'")
if [[ "$BACKEND_VERIFY" == *"MISSING"* ]]; then
    log_error "KRITISCH: Backend wurde beschädigt!"
    log_warning "Stelle Backup wieder her..."
    ssh $SERVER "cd /var/www && rm -rf dojosoftware && tar -xzf $BACKUP_PATH/${BACKUP_NAME}.tar.gz"
    log_info "Backup wiederhergestellt. Bitte manuell prüfen."
    exit 1
fi
log_success "Backend ist weiterhin intakt"

# SCHRITT 5: Zeige Deployment-Info
echo ""
echo "=============================================="
log_success "DEPLOYMENT ERFOLGREICH ABGESCHLOSSEN"
echo "=============================================="
echo ""
log_info "Backup gespeichert unter: $BACKUP_PATH/${BACKUP_NAME}.tar.gz"
log_info "Bei Problemen Rollback mit:"
echo "  ./scripts/rollback-frontend.sh ${BACKUP_NAME}"
echo ""

# Alte Backups aufräumen (behalte die letzten 10)
log_info "Räume alte Backups auf (behalte letzte 10)..."
ssh $SERVER "cd $BACKUP_PATH && ls -t frontend_backup_*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --"
log_success "Fertig!"
