#!/bin/bash
# =============================================================================
# DEPLOY SCRIPT — Dojosoftware
# Lokal → Produktionsserver
#
# Verwendung:
#   ./deploy.sh           — Frontend + Backend
#   ./deploy.sh frontend  — Nur Frontend
#   ./deploy.sh backend   — Nur Backend
# =============================================================================

set -e

# ── Konfiguration ─────────────────────────────────────────────────────────────
SSH_KEY="$HOME/.ssh/id_ed25519_dojo_deploy"
SSH_HOST="root@dojo.tda-intl.org"
SSH_PORT="2222"
SSH_OPT="-p $SSH_PORT -i $SSH_KEY"

FRONTEND_LOCAL="$HOME/dojosoftware/frontend"
FRONTEND_REMOTE="/var/www/dojosoftware/frontend/"
BACKEND_LOCAL="$HOME/dojosoftware/backend/"
BACKEND_REMOTE="/var/www/dojo-backend/backend/"

PM2_APP="dojosoftware-backend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

# ── Argumente ─────────────────────────────────────────────────────────────────
MODE="${1:-all}"
if [[ "$MODE" != "all" && "$MODE" != "frontend" && "$MODE" != "backend" ]]; then
  echo "Verwendung: ./deploy.sh [all|frontend|backend]"
  exit 1
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Dojosoftware → Produktion      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════╝${NC}"
echo ""
echo -e "${RED}⚠️  PRODUKTIONSSERVER — echte Nutzer aktiv!${NC}"
echo -e "   Modus: ${YELLOW}$MODE${NC}"
echo ""
read -p "Fortfahren? (j/N) " confirm
[[ "$confirm" =~ ^[Jj]$ ]] || { echo "Abgebrochen."; exit 0; }
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "backend" ]]; then
  echo -e "${YELLOW}▶ [1/2] Backend deployen...${NC}"

  rsync -ric \
    --exclude='node_modules/' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='.env.active' \
    --exclude='logs/' \
    --exclude='uploads/' \
    --exclude='*.bak' \
    --exclude='*.backup*' \
    --exclude='*.log' \
    -e "ssh $SSH_OPT" \
    "$BACKEND_LOCAL" \
    "$SSH_HOST:$BACKEND_REMOTE" \
    | grep '^>' | sed 's/^>f[^ ]* /  → /' || true

  echo -e "  PM2 restart..."
  ssh $SSH_OPT "$SSH_HOST" "pm2 restart $PM2_APP --silent && sleep 2 && pm2 show $PM2_APP | grep -E 'status|uptime' | head -2"
  echo -e "  ${GREEN}✓ Backend deployed${NC}"
  echo ""
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "frontend" ]]; then
  echo -e "${YELLOW}▶ [2/2] Frontend bauen...${NC}"
  cd "$FRONTEND_LOCAL"
  npm run build 2>&1 | grep -E '✓|error|built in' | head -5
  echo ""

  echo -e "${YELLOW}  Frontend deployen...${NC}"
  rsync -az \
    -e "ssh $SSH_OPT" \
    "$FRONTEND_LOCAL/dist/" \
    "$SSH_HOST:$FRONTEND_REMOTE"
  echo -e "  ${GREEN}✓ Frontend deployed${NC}"
  echo ""
fi

echo -e "${GREEN}✅ Deploy abgeschlossen — https://dojo.tda-intl.org${NC}"
echo -e "   ${YELLOW}Tipp:${NC} Browser-Cache leeren mit Cmd+Shift+R"
echo ""
