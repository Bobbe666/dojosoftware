#!/bin/bash
# =============================================================================
# DB-SYNC SCRIPT — Produktionsdaten → Lokale Testdatenbank
#
# Zieht einen anonymisierten Dump der Produktionsdatenbank
# und importiert ihn in die lokale dojo_test Datenbank.
#
# Verwendung:
#   ./sync-db.sh
# =============================================================================

set -e

# ── Konfiguration ─────────────────────────────────────────────────────────────
SSH_KEY="$HOME/.ssh/id_ed25519_dojo_deploy"
SSH_HOST="root@dojo.tda-intl.org"
SSH_PORT="2222"
SSH_OPT="-p $SSH_PORT -i $SSH_KEY"

REMOTE_ENV="/var/www/dojo-backend/backend/.env"
LOCAL_DB="dojo_test"
LOCAL_DB_USER="root"
DUMP_FILE="/tmp/dojo_prod_dump_$(date +%Y%m%d_%H%M%S).sql"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   DB-Sync: Produktion → dojo_test    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Was passiert:${NC}"
echo -e "  1. Produktions-DB wird auf dem Server gedumpt"
echo -e "  2. Dump wird lokal übertragen"
echo -e "  3. E-Mails werden anonymisiert (Datenschutz)"
echo -e "  4. Lokale dojo_test DB wird überschrieben"
echo ""
echo -e "${RED}⚠️  Lokale dojo_test wird vollständig ersetzt!${NC}"
echo ""
read -p "Fortfahren? (j/N) " confirm
[[ "$confirm" =~ ^[Jj]$ ]] || { echo "Abgebrochen."; exit 0; }
echo ""

# ── Schritt 1: Produktions-Credentials holen ──────────────────────────────────
echo -e "${YELLOW}▶ [1/4] Verbinde mit Server...${NC}"
PROD_DB_PASS=$(ssh $SSH_OPT "$SSH_HOST" "grep DB_PASSWORD $REMOTE_ENV | cut -d= -f2")
PROD_DB_USER=$(ssh $SSH_OPT "$SSH_HOST" "grep DB_USER $REMOTE_ENV | cut -d= -f2")
PROD_DB_NAME=$(ssh $SSH_OPT "$SSH_HOST" "grep 'DB_NAME=' $REMOTE_ENV | cut -d= -f2")
echo -e "  ${GREEN}✓ Server erreichbar, DB: $PROD_DB_NAME${NC}"

# ── Schritt 2: Dump auf Server erstellen und übertragen ───────────────────────
echo ""
echo -e "${YELLOW}▶ [2/4] Dump erstellen und übertragen...${NC}"
ssh $SSH_OPT "$SSH_HOST" \
  "mysqldump -u $PROD_DB_USER -p'$PROD_DB_PASS' $PROD_DB_NAME 2>/dev/null" \
  > "$DUMP_FILE"

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo -e "  ${GREEN}✓ Dump übertragen: $DUMP_SIZE ($DUMP_FILE)${NC}"

# ── Schritt 3: Anonymisieren ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ [3/4] Anonymisiere sensible Daten...${NC}"

# E-Mails durch test-Versionen ersetzen (domain bleibt für Format erkennbar)
# Passwörter bleiben als bcrypt-Hash — kein Sicherheitsrisiko
sed -i '' \
  -e "s/'[a-zA-Z0-9._%+\-]*@[a-zA-Z0-9.\-]*\.[a-zA-Z]\{2,\}'/'test@example.local'/g" \
  "$DUMP_FILE"

# IBAN maskieren (DE + 18 Ziffern → Testwert)
sed -i '' \
  -e "s/'DE[0-9]\{20\}'/'DE89370400440532013000'/g" \
  "$DUMP_FILE"

echo -e "  ${GREEN}✓ E-Mails anonymisiert, IBANs maskiert${NC}"

# ── Schritt 4: In lokale DB importieren ──────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ [4/4] Importiere in lokale dojo_test DB...${NC}"

mysql -u "$LOCAL_DB_USER" -e "DROP DATABASE IF EXISTS $LOCAL_DB; CREATE DATABASE $LOCAL_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
mysql -u "$LOCAL_DB_USER" "$LOCAL_DB" < "$DUMP_FILE" 2>/dev/null

# Aufräumen
rm "$DUMP_FILE"

echo -e "  ${GREEN}✓ Importiert — dojo_test ist jetzt aktuell${NC}"
echo ""
echo -e "${GREEN}✅ DB-Sync abgeschlossen!${NC}"
echo ""
echo -e "  Starte Backend lokal:   ${YELLOW}cd backend && npm run dev${NC}"
echo -e "  Starte Frontend lokal:  ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
