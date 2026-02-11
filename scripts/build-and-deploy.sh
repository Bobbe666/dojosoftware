#!/bin/bash
# =============================================================================
# BUILD UND DEPLOY SCRIPT
# =============================================================================
# Kombiniert Frontend-Build und sicheres Deployment
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$PROJECT_ROOT"

echo ""
echo "=============================================="
echo "  BUILD UND DEPLOY"
echo "=============================================="
echo ""

# SCHRITT 1: Frontend bauen
log_info "Baue Frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    log_error "Build fehlgeschlagen!"
    exit 1
fi
log_success "Build erfolgreich"
cd ..

# SCHRITT 2: Deployment
log_info "Starte Deployment..."
"$SCRIPT_DIR/deploy-frontend.sh"
