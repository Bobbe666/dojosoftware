#!/bin/bash
# =====================================================
# DojoSoftware - Automatisches Deployment-Script
# =====================================================
# Committed lokale Änderungen, pusht zu Git und deployed auf Server
#
# Verwendung:
#   ./deploy.sh                    # Mit Commit-Message-Prompt
#   ./deploy.sh "Meine Message"    # Mit eigener Message
#   ./deploy.sh --skip-commit      # Nur Deploy (kein Commit)

set -e  # Exit bei Fehler

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server-Konfiguration
SERVER_USER="root"
SERVER_HOST="dojo.tda-intl.org"
SERVER_PATH="/var/www/dojosoftware"
PM2_APP_NAME="dojosoftware"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   DojoSoftware - Automatisches Deployment     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo ""

# =====================================================
# 1. LOKALE ÄNDERUNGEN COMMITEN & PUSHEN
# =====================================================

if [ "$1" != "--skip-commit" ]; then
    echo -e "${YELLOW}📋 Schritt 1: Lokale Änderungen prüfen...${NC}"

    # Prüfe ob es Änderungen gibt
    if [[ -n $(git status -s) ]]; then
        echo -e "${GREEN}✓ Änderungen gefunden${NC}"
        git status --short
        echo ""

        # Commit-Message
        if [ -z "$1" ]; then
            echo -e "${YELLOW}💬 Commit-Message eingeben:${NC}"
            read -p "> " COMMIT_MSG
        else
            COMMIT_MSG="$1"
        fi

        # Alle Änderungen stagen
        echo -e "${YELLOW}📦 Stage alle Änderungen...${NC}"
        git add -A

        # Commit erstellen
        echo -e "${YELLOW}💾 Erstelle Commit...${NC}"
        git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

        echo -e "${GREEN}✓ Commit erstellt${NC}"
    else
        echo -e "${GREEN}✓ Keine lokalen Änderungen${NC}"
    fi

    # Push to remote
    echo ""
    echo -e "${YELLOW}🚀 Schritt 2: Push zu GitHub...${NC}"
    git push origin main
    echo -e "${GREEN}✓ Erfolgreich gepusht${NC}"
else
    echo -e "${YELLOW}⏭️  Überspringe Commit (--skip-commit)${NC}"
fi

# =====================================================
# 2. AUF SERVER DEPLOYEN
# =====================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Deployment auf Production-Server        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}🔗 Verbinde mit Server: ${SERVER_HOST}${NC}"

# SSH Deployment-Befehle
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
set -e

# Farben für Server-Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd /var/www/dojosoftware

echo -e "${YELLOW}📥 Schritt 3: Git Pull auf Server...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code aktualisiert${NC}"

echo ""
echo -e "${YELLOW}📦 Schritt 4: Backend Dependencies...${NC}"
cd backend
if npm install --production; then
    echo -e "${GREEN}✓ Backend Dependencies installiert${NC}"
else
    echo -e "${RED}✗ Backend Dependencies Fehler${NC}"
fi

echo ""
echo -e "${YELLOW}📦 Schritt 5: Frontend Dependencies...${NC}"
cd ../frontend
if npm install; then
    echo -e "${GREEN}✓ Frontend Dependencies installiert${NC}"
else
    echo -e "${RED}✗ Frontend Dependencies Fehler${NC}"
fi

echo ""
echo -e "${YELLOW}🏗️  Schritt 6: Frontend Build...${NC}"
if NODE_ENV=production npm run build; then
    echo -e "${GREEN}✓ Frontend Build erfolgreich${NC}"
else
    echo -e "${RED}✗ Frontend Build fehlgeschlagen${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔄 Schritt 7: Backend neu starten...${NC}"
cd ../backend

# Prüfe ob PM2 läuft
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q dojosoftware; then
        echo "  → PM2 Restart..."
        pm2 restart dojosoftware
    else
        echo "  → PM2 Start..."
        pm2 start server.js --name dojosoftware
    fi
    pm2 save
    echo -e "${GREEN}✓ Backend neu gestartet (PM2)${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 nicht gefunden, starte mit node...${NC}"
    pkill -f "node server.js" || true
    nohup node server.js > /var/log/dojosoftware-backend.log 2>&1 &
    echo -e "${GREEN}✓ Backend gestartet${NC}"
fi

echo ""
echo -e "${YELLOW}🔄 Schritt 8: Nginx Reload...${NC}"
if command -v nginx &> /dev/null; then
    sudo nginx -t && sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx neu geladen${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx nicht gefunden${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✓ DEPLOYMENT ERFOLGREICH!            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Produktiv-URL: https://dojo.tda-intl.org${NC}"
echo ""

# Status anzeigen
echo -e "${YELLOW}📊 Server-Status:${NC}"
if command -v pm2 &> /dev/null; then
    pm2 list
fi

ENDSSH

# =====================================================
# 3. DEPLOYMENT ERFOLGREICH
# =====================================================

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     🎉 DEPLOYMENT ABGESCHLOSSEN! 🎉            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Lokal:     http://localhost:5173${NC}"
echo -e "${BLUE}🌐 Produktiv: https://dojo.tda-intl.org${NC}"
echo ""
echo -e "${YELLOW}💡 Tipp: Mache einen Hard-Refresh im Browser (Cmd+Shift+R)${NC}"
echo ""
