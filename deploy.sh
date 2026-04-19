#!/bin/bash
# =============================================================================
# DEPLOY SCRIPT — Dojosoftware (Git-basiert)
#
# Workflow Backend: git push lokal → Server git pull → pm2 restart
# Workflow Frontend: npm build lokal → rsync dist/ → Webroot
#
# Verwendung:
#   ./deploy.sh           — Frontend + Backend
#   ./deploy.sh frontend  — Nur Frontend
#   ./deploy.sh backend   — Nur Backend
# =============================================================================

set -e

SSH_KEY="$HOME/.ssh/id_ed25519_dojo_deploy"
SSH_HOST="root@dojo.tda-intl.org"
SSH_PORT="2222"
SSH_OPT="-p $SSH_PORT -i $SSH_KEY"

FRONTEND_LOCAL="$HOME/dojosoftware/frontend"
SOURCE_REMOTE="/var/www/dojosoftware-source"
FRONTEND_REMOTE_1="/var/www/dojosoftware/frontend/"
FRONTEND_REMOTE_2="/var/www/member-app/"
PM2_APP="dojosoftware-backend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

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

# ── Prüfe lokalen Git-Status ──────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "backend" ]]; then
  if [[ -n "$(git -C "$HOME/dojosoftware" status --porcelain)" ]]; then
    echo -e "${RED}⚠️  Uncommittete Änderungen vorhanden!${NC}"
    git -C "$HOME/dojosoftware" status --short | head -10
    echo ""
    echo -e "   Backend-Deploy überträgt nur was in git ist."
    echo -e "   Bitte committen: ${YELLOW}git add -A && git commit -m '...'${NC}"
    echo ""
  fi
  LOCAL_COMMIT=$(git -C "$HOME/dojosoftware" rev-parse --short HEAD)
  echo -e "   Lokaler Stand: ${YELLOW}$LOCAL_COMMIT${NC} $(git -C "$HOME/dojosoftware" log -1 --format='%s')"
  echo ""
fi

read -p "Fortfahren? (j/N) " confirm
[[ "$confirm" =~ ^[Jj]$ ]] || { echo "Abgebrochen."; exit 0; }
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "backend" ]]; then
  echo -e "${YELLOW}▶ [1/2] Backend deployen (git push → server git pull)...${NC}"

  # Lokal pushen
  git -C "$HOME/dojosoftware" push origin main 2>&1 | grep -E 'main|up-to-date|error' || true

  # Server: git pull + npm install (nur wenn package.json geändert) + pm2 restart
  ssh $SSH_OPT "$SSH_HOST" "
    cd $SOURCE_REMOTE
    git pull 2>&1 | tail -3
    # npm install nur wenn package-lock.json geändert wurde
    if git diff HEAD@{1} --name-only 2>/dev/null | grep -q 'package-lock.json\|package.json'; then
      echo '  → npm install (package.json geändert)...'
      cd backend && npm install --production 2>&1 | tail -2
    fi
    pm2 restart $PM2_APP --silent
    sleep 2
    pm2 show $PM2_APP | grep -E 'status|uptime' | head -2
  "

  REMOTE_COMMIT=$(ssh $SSH_OPT "$SSH_HOST" "cd $SOURCE_REMOTE && git rev-parse --short HEAD")
  echo -e "  ${GREEN}✓ Backend deployed — Server: $REMOTE_COMMIT${NC}"
  echo ""
fi

# ── Frontend ──────────────────────────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "frontend" ]]; then
  echo -e "${YELLOW}▶ [2/2] Frontend bauen...${NC}"
  cd "$FRONTEND_LOCAL"
  CI=false npm run build 2>&1 | grep -E '✓|error|built in' | head -5
  echo ""

  echo -e "${YELLOW}  Frontend deployen (2 Webroots)...${NC}"
  rsync -az -e "ssh $SSH_OPT" "$FRONTEND_LOCAL/dist/" "$SSH_HOST:$FRONTEND_REMOTE_1"
  rsync -az -e "ssh $SSH_OPT" "$FRONTEND_LOCAL/dist/" "$SSH_HOST:$FRONTEND_REMOTE_2"
  echo -e "  ${GREEN}✓ Frontend deployed (dojo.tda-intl.org + app.tda-vib.de)${NC}"
  echo ""
fi

echo -e "${GREEN}✅ Deploy abgeschlossen — https://dojo.tda-intl.org${NC}"
echo -e "   ${YELLOW}Tipp:${NC} Browser-Cache leeren mit Cmd+Shift+R"
echo ""
