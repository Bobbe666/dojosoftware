#!/bin/bash
# =============================================================================
# DB-SYNC — Produktion → Lokal
#
# Zieht einen anonymisierten Dump der Produktionsdatenbank
# und importiert ihn in die lokale dojo DB.
#
# Verwendung:
#   ./sync-db.sh
# =============================================================================

set -e

SSH_KEY="$HOME/.ssh/id_ed25519_dojo_deploy"
SSH_HOST="root@dojo.tda-intl.org"
SSH_PORT="2222"
SSH_OPT="-p $SSH_PORT -i $SSH_KEY -o StrictHostKeyChecking=no"

REMOTE_ENV="/var/www/dojosoftware-source/backend/.env"
LOCAL_DB="dojo"
LOCAL_DB_USER="dojoUser"
LOCAL_DB_PASS='aaBobbe100aa$'
RAW_FILE="/tmp/dojo_raw_$(date +%Y%m%d_%H%M%S).sql"
CLEAN_FILE="/tmp/dojo_clean_$(date +%Y%m%d_%H%M%S).sql"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   DB-Sync: Produktion → Lokal (dojo)     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Was passiert:${NC}"
echo -e "  1. Produktions-DB wird auf dem Server gedumpt"
echo -e "  2. Dump wird lokal übertragen"
echo -e "  3. MariaDB→MySQL Kompatibilität wird hergestellt"
echo -e "  4. E-Mails/IBANs werden anonymisiert (DSGVO)"
echo -e "  5. Lokale dojo DB wird vollständig ersetzt"
echo ""
echo -e "${RED}⚠️  Die lokale dojo Datenbank wird komplett überschrieben!${NC}"
echo ""
read -p "Fortfahren? (j/N) " confirm
[[ "$confirm" =~ ^[Jj]$ ]] || { echo "Abgebrochen."; exit 0; }
echo ""

# ── Schritt 1: Verbindung prüfen ──────────────────────────────────────────────
echo -e "${YELLOW}▶ [1/5] Verbinde mit Server...${NC}"
PROD_DB_PASS=$(ssh $SSH_OPT "$SSH_HOST" "grep 'DB_PASSWORD=' $REMOTE_ENV | cut -d= -f2-")
PROD_DB_USER=$(ssh $SSH_OPT "$SSH_HOST" "grep 'DB_USER=' $REMOTE_ENV | head -1 | cut -d= -f2")
PROD_DB_NAME=$(ssh $SSH_OPT "$SSH_HOST" "grep 'DB_NAME=' $REMOTE_ENV | head -1 | cut -d= -f2")
echo -e "  ${GREEN}✓ Server erreichbar — DB: $PROD_DB_NAME${NC}"

# ── Schritt 2: Dump erstellen und übertragen ──────────────────────────────────
echo ""
echo -e "${YELLOW}▶ [2/5] Dump erstellen und übertragen...${NC}"
ssh $SSH_OPT "$SSH_HOST" \
  "mysqldump -u \"$PROD_DB_USER\" -p\"$PROD_DB_PASS\" \
   --single-transaction --quick --skip-lock-tables \
   --routines --triggers \
   \"$PROD_DB_NAME\" 2>/dev/null" \
  > "$RAW_FILE"

RAW_SIZE=$(du -sh "$RAW_FILE" | cut -f1)
echo -e "  ${GREEN}✓ Dump übertragen: $RAW_SIZE${NC}"

# ── Schritt 3: MariaDB→MySQL Kompatibilität ───────────────────────────────────
echo ""
echo -e "${YELLOW}▶ [3/5] Bereinige für MySQL-Kompatibilität...${NC}"

python3 - "$RAW_FILE" "$CLEAN_FILE" << 'PYEOF'
import sys, re

src, dst = sys.argv[1], sys.argv[2]
with open(src, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# 1) NO_AUTO_CREATE_USER aus sql_mode entfernen (MySQL 8+/9+ kennt es nicht)
content = re.sub(r',NO_AUTO_CREATE_USER', '', content)

# 2) DEFAULT curdate() → DEFAULT (curdate())  [MariaDB erlaubt ohne Klammern]
content = re.sub(r'\bDEFAULT curdate\(\)', 'DEFAULT (curdate())', content)

# 3) DEFAULT now() → DEFAULT (now())
content = re.sub(r'\bDEFAULT now\(\)', 'DEFAULT (now())', content)

# 4) TEXT/BLOB/JSON-Spalten dürfen in MySQL keinen literal DEFAULT-Wert haben
#    Behandelt auch: TYPE CHARACTER SET x COLLATE y NOT NULL DEFAULT 'val'
def strip_text_defaults(line):
    return re.sub(
        r"((?:LONG)?(?:TEXT|BLOB)|JSON|TINYTEXT|MEDIUMTEXT)"
        r"((?:\s+CHARACTER SET\s+\S+)?(?:\s+COLLATE\s+\S+)?)"
        r"(\s+(?:NOT NULL\s+)?)"
        r"DEFAULT\s+'[^']*'",
        r'\1\2\3',
        line,
        flags=re.IGNORECASE
    )

lines = content.split('\n')
lines = [strip_text_defaults(l) for l in lines]
content = '\n'.join(lines)

# 5) MariaDB-spezifische Kommentare
content = re.sub(r'/\*!999999\\- enable the sandbox mode \*/', '', content)

# 6) E-Mails eindeutig anonymisieren (verhindert Duplicate Key auf UNIQUE-Spalten)
_email_counter = [0]
def unique_email(m):
    _email_counter[0] += 1
    return f"'anon{_email_counter[0]}@example.local'"
content = re.sub(r"'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'", unique_email, content)

# 7) IBANs eindeutig maskieren
_iban_counter = [0]
def mask_iban(m):
    _iban_counter[0] += 1
    return f"'DE89370400440532013{_iban_counter[0]:03d}'"
content = re.sub(r"'DE[0-9]{20}'", mask_iban, content)

with open(dst, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"  Bereinigung abgeschlossen ({_email_counter[0]} E-Mails, {_iban_counter[0]} IBANs anonymisiert).")
PYEOF

CLEAN_SIZE=$(du -sh "$CLEAN_FILE" | cut -f1)
echo -e "  ${GREEN}✓ Bereinigt: $CLEAN_SIZE${NC}"

# ── Schritt 4: DSGVO-Bestätigung ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}▶ [4/5] DSGVO-Anonymisierung...${NC}"
echo -e "  ${GREEN}✓ E-Mails und IBANs wurden bereits im Bereinigungsschritt eindeutig anonymisiert${NC}"

# ── Schritt 5: In lokale dojo DB importieren ─────────────────────────────────
echo ""
echo -e "${YELLOW}▶ [5/5] Importiere in lokale dojo DB...${NC}"

# Alte Tabellen wegräumen (root, da dojoUser keine globalen DROP-Rechte hat)
echo -e "  Lösche bestehende Tabellen..."
EXISTING_TABLES=$(mysql -u root -N -e \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='$LOCAL_DB';" 2>/dev/null)

if [ -n "$EXISTING_TABLES" ]; then
  DROP_STMTS="SET FOREIGN_KEY_CHECKS=0;"
  while IFS= read -r tbl; do
    DROP_STMTS+=" DROP TABLE IF EXISTS \`$LOCAL_DB\`.\`$tbl\`;"
  done <<< "$EXISTING_TABLES"
  DROP_STMTS+=" SET FOREIGN_KEY_CHECKS=1;"
  mysql -u root -e "$DROP_STMTS" 2>/dev/null
fi

# Import (log_bin_trust als GLOBAL setzen, da --init-command nur SESSION-Scope hat)
mysql -u root -e "SET GLOBAL log_bin_trust_function_creators=1;" 2>/dev/null || true
mysql -u root "$LOCAL_DB" < "$CLEAN_FILE" 2>&1 | grep -i "error" | head -20 || true

# Tabellenzahl prüfen
TABLE_COUNT=$(mysql -u root -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$LOCAL_DB';" 2>/dev/null)

rm -f "$RAW_FILE" "$CLEAN_FILE"

if [ "$TABLE_COUNT" -gt 50 ]; then
  echo -e "  ${GREEN}✓ Importiert — $TABLE_COUNT Tabellen in lokaler dojo DB${NC}"
else
  echo -e "  ${RED}⚠ Nur $TABLE_COUNT Tabellen importiert — evtl. Fehler prüfen${NC}"
fi

echo ""
echo -e "${GREEN}✅ DB-Sync abgeschlossen!${NC}"
echo ""
echo -e "  Backend lokal starten:   ${YELLOW}cd /Users/schreinersascha/dojosoftware/backend && npm run dev${NC}"
echo -e "  Frontend lokal starten:  ${YELLOW}cd /Users/schreinersascha/dojosoftware/frontend && npm run dev${NC}"
echo ""
