#!/bin/bash
# =============================================================================
# SICHERES BACKEND DEPLOYMENT SCRIPT
# =============================================================================
# Dieses Script:
# 1. Erstellt IMMER ein Backup vor dem Deployment
# 2. Synchronisiert Backend-Code (OHNE node_modules, .env, logs, uploads)
# 3. Führt npm install aus
# 4. Startet PM2 neu
# =============================================================================

set -e

# Konfiguration
SERVER="dojo.tda-intl.org"
REMOTE_PATH="/var/www/dojosoftware/backend"
BACKUP_PATH="/var/www/backups/dojosoftware"
LOCAL_BACKEND="backend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

cd "$PROJECT_ROOT"
if [ ! -d "$LOCAL_BACKEND" ]; then
    log_error "Backend Verzeichnis nicht gefunden: $LOCAL_BACKEND"
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backend_backup_${TIMESTAMP}"

echo ""
echo "=============================================="
echo "  SICHERES BACKEND DEPLOYMENT"
echo "=============================================="
echo ""
log_info "Server: $SERVER"
log_info "Backup Name: $BACKUP_NAME"
echo ""

# SCHRITT 1: Backup erstellen
echo "----------------------------------------------"
log_info "SCHRITT 1: Erstelle Backup auf dem Server..."
echo "----------------------------------------------"

ssh $SERVER "mkdir -p $BACKUP_PATH && \
    tar -czf $BACKUP_PATH/${BACKUP_NAME}.tar.gz \
        -C /var/www/dojosoftware backend && \
    echo 'Backup erstellt'"

log_success "Backup erstellt: $BACKUP_PATH/${BACKUP_NAME}.tar.gz"

# SCHRITT 2: Sichere kritische Dateien
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 2: Sichere .env und andere kritische Dateien..."
echo "----------------------------------------------"

ssh $SERVER "cp $REMOTE_PATH/.env $BACKUP_PATH/.env.backup.${TIMESTAMP} 2>/dev/null || true"
log_success "Kritische Dateien gesichert"

# SCHRITT 3: Synchronisiere Backend-Code
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 3: Synchronisiere Backend-Code..."
echo "----------------------------------------------"

rsync -avz \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='logs' \
    --exclude='uploads' \
    --exclude='*.log' \
    --exclude='coverage' \
    --exclude='generated_documents' \
    "$LOCAL_BACKEND/" "$SERVER:$REMOTE_PATH/"

log_success "Code synchronisiert"

# SCHRITT 4: Stelle .env wieder her
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 4: Stelle .env wieder her..."
echo "----------------------------------------------"

ssh $SERVER "cp $BACKUP_PATH/.env.backup.${TIMESTAMP} $REMOTE_PATH/.env 2>/dev/null || echo '.env war nicht gesichert - bitte manuell prüfen'"
log_success ".env wiederhergestellt"

# SCHRITT 5: npm install
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 5: Installiere Dependencies..."
echo "----------------------------------------------"

ssh $SERVER "cd $REMOTE_PATH && npm install --production 2>&1 | tail -10"
log_success "Dependencies installiert"

# SCHRITT 6: PM2 Neustart
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 6: Starte Backend neu..."
echo "----------------------------------------------"

ssh $SERVER "pm2 restart dojosoftware-backend && sleep 3 && pm2 status"

# SCHRITT 7: Verifiziere
echo ""
echo "----------------------------------------------"
log_info "SCHRITT 7: Verifiziere Backend..."
echo "----------------------------------------------"

HEALTH=$(ssh $SERVER "curl -s http://localhost:5001/api/test 2>/dev/null | grep -o 'success.*true' || echo 'FAILED'")
if [[ "$HEALTH" == *"success"* ]]; then
    log_success "Backend läuft korrekt"
else
    log_error "Backend-Health-Check fehlgeschlagen!"
    log_warning "Manuell prüfen: pm2 logs dojosoftware-backend"
fi

echo ""
echo "=============================================="
log_success "BACKEND DEPLOYMENT ABGESCHLOSSEN"
echo "=============================================="
echo ""
log_info "Backup: $BACKUP_PATH/${BACKUP_NAME}.tar.gz"
echo ""

# Alte Backups aufräumen (behalte die letzten 10)
log_info "Räume alte Backups auf..."
ssh $SERVER "cd $BACKUP_PATH && ls -t backend_backup_*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --"
log_success "Fertig!"
