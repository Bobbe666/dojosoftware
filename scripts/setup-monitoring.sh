#!/bin/bash
# Richtet den Health-Check Cron auf dem Server ein
# Lokal aufrufen: bash scripts/setup-monitoring.sh
# Setzt voraus: deploy.sh wurde schon einmal ausgeführt (Script liegt auf Server)

SERVER="root@dojo.tda-intl.org"
SSH_PORT=2222
SSH_KEY="$HOME/.ssh/id_ed25519_dojo_deploy"
REMOTE_SCRIPT="/usr/local/bin/dojo-health-check.sh"
SOURCE_SCRIPT="$(dirname "$0")/server-health-check.sh"

echo "📋 Installiere Health-Check-Cron auf $SERVER ..."

# Script hochladen
scp -P "$SSH_PORT" -i "$SSH_KEY" "$SOURCE_SCRIPT" "$SERVER:$REMOTE_SCRIPT"
if [ $? -ne 0 ]; then
  echo "❌ Upload fehlgeschlagen"
  exit 1
fi

# Ausführbar machen und Cron einrichten
ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SERVER" "
  chmod +x $REMOTE_SCRIPT
  touch /var/log/dojo-health.log
  chmod 644 /var/log/dojo-health.log

  # Cron-Eintrag: alle 5 Minuten
  CRON_LINE='*/5 * * * * $REMOTE_SCRIPT >> /var/log/dojo-health.log 2>&1'

  # Vorhandene Zeile entfernen, neue hinzufügen
  (crontab -l 2>/dev/null | grep -v 'dojo-health-check' ; echo \"\$CRON_LINE\") | crontab -

  echo '✅ Cron eingerichtet:'
  crontab -l | grep dojo-health
  echo ''
  echo 'Test-Run (einmalig):'
  $REMOTE_SCRIPT && echo 'Script-Test OK'
"
echo "✅ Setup abgeschlossen."
