#!/bin/bash
# ============================================================
# SICHERES DEPLOYMENT SCRIPT - dojosoftware
# ============================================================
# WICHTIG: Dieses Script deployed NUR das Frontend!
# Backend, .env und uploads werden NIEMALS angefasst!
#
# Verwendung:
#   ./deploy.sh              # Normales Deployment
#   ./deploy.sh --build      # Mit vorherigem Build
#   ./deploy.sh --backend    # Auch Backend deployen (vorsichtig!)
# ============================================================

set -e  # Bei Fehler abbrechen

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Konfiguration
SERVER="dojo.tda-intl.org"
REMOTE_PATH="/var/www/dojosoftware"
LOCAL_FRONTEND_DIST="./frontend/dist"
LOCAL_BACKEND="./backend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Wechsle ins Script-Verzeichnis
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       DOJOSOFTWARE - SICHERES DEPLOYMENT                  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parameter prüfen
DO_BUILD=false
DO_BACKEND=false

for arg in "$@"; do
    case $arg in
        --build)
            DO_BUILD=true
            ;;
        --backend)
            DO_BACKEND=true
            ;;
    esac
done

# ============================================================
# SCHRITT 1: Prüfungen
# ============================================================
echo -e "${CYAN}[1/6] Prüfe Voraussetzungen...${NC}"

# Prüfe SSH-Verbindung
echo -e "   Teste SSH-Verbindung..."
if ! ssh -o ConnectTimeout=5 "$SERVER" "echo 'OK'" > /dev/null 2>&1; then
    echo -e "${RED}   ✗ FEHLER: Keine SSH-Verbindung zu $SERVER!${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ SSH-Verbindung OK${NC}"

# ============================================================
# SCHRITT 2: Build (optional)
# ============================================================
if [ "$DO_BUILD" = true ]; then
    echo ""
    echo -e "${CYAN}[2/6] Erstelle Frontend-Build...${NC}"
    cd frontend
    npm run build
    cd ..
    echo -e "${GREEN}   ✓ Build erfolgreich${NC}"
else
    echo ""
    echo -e "${YELLOW}[2/6] Build übersprungen (nutze --build für neuen Build)${NC}"
fi

# Prüfe ob dist existiert
if [ ! -d "$LOCAL_FRONTEND_DIST" ]; then
    echo -e "${RED}   ✗ FEHLER: $LOCAL_FRONTEND_DIST existiert nicht!${NC}"
    echo -e "${YELLOW}   Führe './deploy.sh --build' aus.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Frontend dist vorhanden${NC}"

# ============================================================
# SCHRITT 3: Remote-Backup erstellen
# ============================================================
echo ""
echo -e "${CYAN}[3/6] Erstelle Remote-Backup kritischer Dateien...${NC}"

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
ssh "$SERVER" "
    mkdir -p /root/backups/dojosoftware

    # Backup .env (WICHTIG!)
    if [ -f $REMOTE_PATH/backend/.env ]; then
        cp $REMOTE_PATH/backend/.env /root/backups/dojosoftware/.env.backup.$BACKUP_DATE
        echo '   ✓ .env gesichert nach /root/backups/dojosoftware/.env.backup.$BACKUP_DATE'
    else
        echo '   ⚠ WARNUNG: Keine .env gefunden!'
    fi

    # Prüfe kritische Ordner
    if [ ! -d $REMOTE_PATH/backend ]; then
        echo '   ✗ KRITISCH: Backend-Ordner fehlt auf Server!'
        exit 1
    fi
    echo '   ✓ Backend-Ordner vorhanden'

    if [ ! -d $REMOTE_PATH/uploads ]; then
        echo '   ⚠ uploads-Ordner fehlt, wird erstellt...'
        mkdir -p $REMOTE_PATH/uploads
    fi
    echo '   ✓ uploads-Ordner vorhanden'
"

# ============================================================
# SCHRITT 4: Frontend deployen
# ============================================================
echo ""
echo -e "${CYAN}[4/6] Deploye Frontend...${NC}"
echo -e "   Quelle: $LOCAL_FRONTEND_DIST"
echo -e "   Ziel:   $SERVER:$REMOTE_PATH"
echo ""

# ╔═══════════════════════════════════════════════════════════╗
# ║  WICHTIG: KEIN --delete FLAG!                             ║
# ║  Explizite Excludes für maximale Sicherheit               ║
# ╚═══════════════════════════════════════════════════════════╝
rsync -avz --progress \
    --exclude 'backend' \
    --exclude 'backend/**' \
    --exclude '.env' \
    --exclude '.env.*' \
    --exclude 'uploads' \
    --exclude 'uploads/**' \
    --exclude 'node_modules' \
    --exclude 'node_modules/**' \
    --exclude '.git' \
    --exclude '.git/**' \
    --exclude 'logs' \
    --exclude 'logs/**' \
    "$LOCAL_FRONTEND_DIST/" "$SERVER:$REMOTE_PATH/"

echo ""
echo -e "${GREEN}   ✓ Frontend deployed${NC}"

# ============================================================
# SCHRITT 5: Backend deployen (optional, mit Bestätigung)
# ============================================================
if [ "$DO_BACKEND" = true ]; then
    echo ""
    echo -e "${YELLOW}[5/6] Backend-Deployment angefordert...${NC}"
    echo -e "${RED}   ⚠ WARNUNG: Dies überschreibt Backend-Dateien!${NC}"
    echo -e "${RED}   ⚠ Die .env wird NICHT überschrieben.${NC}"
    read -p "   Wirklich fortfahren? (j/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Jj]$ ]]; then
        echo -e "   Deploye Backend (ohne .env, node_modules, logs)..."

        rsync -avz --progress \
            --exclude '.env' \
            --exclude '.env.*' \
            --exclude 'node_modules' \
            --exclude 'node_modules/**' \
            --exclude 'logs' \
            --exclude 'logs/**' \
            --exclude 'uploads' \
            --exclude 'uploads/**' \
            "$LOCAL_BACKEND/" "$SERVER:$REMOTE_PATH/backend/"

        echo ""
        echo -e "   Installiere Backend Dependencies..."
        ssh "$SERVER" "cd $REMOTE_PATH/backend && npm install --production"

        echo -e "${GREEN}   ✓ Backend deployed${NC}"
    else
        echo -e "${YELLOW}   Backend-Deployment abgebrochen${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}[5/6] Backend-Deployment übersprungen (nutze --backend falls nötig)${NC}"
fi

# ============================================================
# SCHRITT 6: Verifizierung und Neustart
# ============================================================
echo ""
echo -e "${CYAN}[6/6] Verifiziere und starte Dienste neu...${NC}"

ssh "$SERVER" "
    ERRORS=0

    # Prüfe kritische Dateien/Ordner
    echo '   Prüfe Dateien...'

    if [ ! -d $REMOTE_PATH/backend ]; then
        echo '   ✗ FEHLER: Backend-Ordner fehlt!'
        ERRORS=1
    else
        echo '   ✓ Backend-Ordner OK'
    fi

    if [ ! -f $REMOTE_PATH/backend/.env ]; then
        echo '   ✗ FEHLER: .env fehlt!'
        ERRORS=1
    else
        echo '   ✓ .env OK'
    fi

    if [ ! -f $REMOTE_PATH/index.html ]; then
        echo '   ✗ FEHLER: index.html fehlt!'
        ERRORS=1
    else
        echo '   ✓ index.html OK'
    fi

    if [ \$ERRORS -eq 1 ]; then
        echo ''
        echo '   ✗ KRITISCHE FEHLER GEFUNDEN!'
        echo '   Backup wiederherstellen: cp /root/backups/dojosoftware/.env.backup.* $REMOTE_PATH/backend/.env'
        exit 1
    fi

    # Backend neustarten
    echo ''
    echo '   Starte Backend neu...'
    pm2 restart dojosoftware-backend 2>/dev/null || pm2 start $REMOTE_PATH/backend/server.js --name dojosoftware-backend
    pm2 save

    # Kurz warten und Status prüfen
    sleep 2

    if pm2 list | grep -q 'dojosoftware-backend.*online'; then
        echo '   ✓ Backend läuft'
    else
        echo '   ⚠ Backend Status prüfen mit: pm2 logs dojosoftware-backend'
    fi

    # Nginx reload
    echo ''
    echo '   Lade Nginx neu...'
    systemctl reload nginx 2>/dev/null && echo '   ✓ Nginx neu geladen' || echo '   ⚠ Nginx Reload fehlgeschlagen'
"

if [ $? -ne 0 ]; then
    echo -e "${RED}   ✗ FEHLER bei der Verifizierung!${NC}"
    echo -e "${YELLOW}   Prüfe Server manuell oder stelle Backup wieder her.${NC}"
    exit 1
fi

# ============================================================
# FERTIG
# ============================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✓ DEPLOYMENT ERFOLGREICH!                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "   ${BLUE}Frontend:${NC}  https://dojo.tda-intl.org"
echo -e "   ${BLUE}Backup:${NC}    /root/backups/dojosoftware/.env.backup.$BACKUP_DATE"
echo ""
echo -e "   ${YELLOW}Tipp:${NC} Browser-Cache leeren mit Cmd+Shift+R"
echo ""
