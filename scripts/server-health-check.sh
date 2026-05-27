#!/bin/bash
# Dojosoftware Health Monitor
# Läuft alle 5 Minuten via systemd cron
# Sendet E-Mail wenn Backend oder kritische Services nicht erreichbar sind

HEALTH_URL="https://dojo.tda-intl.org/api/health"
NOTIFY_EMAIL="info@tda-intl.com"
LOCK_FILE="/tmp/dojo-health-alert.lock"
LOCK_TTL=1800  # 30 Minuten — kein Spam bei dauerhaftem Ausfall
LOG_FILE="/var/log/dojo-health.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
  echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

send_alert() {
  local subject="$1"
  local body="$2"

  # Lock prüfen (kein Alert-Spam)
  if [ -f "$LOCK_FILE" ]; then
    local lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
    if [ "$lock_age" -lt "$LOCK_TTL" ]; then
      log "Alert unterdrückt (Lock aktiv, ${lock_age}s alt)"
      return
    fi
  fi

  touch "$LOCK_FILE"
  log "ALERT: $subject"

  # sendmail / mail - je nach Verfügbarkeit
  if command -v sendmail >/dev/null 2>&1; then
    {
      echo "To: $NOTIFY_EMAIL"
      echo "From: monitoring@tda-intl.org"
      echo "Subject: $subject"
      echo "Content-Type: text/plain; charset=UTF-8"
      echo ""
      echo "$body"
    } | sendmail -t
  elif command -v mail >/dev/null 2>&1; then
    echo "$body" | mail -s "$subject" "$NOTIFY_EMAIL"
  else
    log "WARNUNG: Kein mail-Programm gefunden, Alert nur geloggt"
  fi
}

recover_alert() {
  if [ -f "$LOCK_FILE" ]; then
    rm -f "$LOCK_FILE"
    log "Recovery erkannt — Lock entfernt"
    send_alert \
      "[OK] Dojosoftware Backend wieder online" \
      "Das Backend unter $HEALTH_URL ist wieder erreichbar.

Zeitpunkt: $TIMESTAMP
Server: dojo.tda-intl.org"
  fi
}

# HTTP-Check mit Timeout
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 --connect-timeout 5 "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_STATUS" = "200" ]; then
  log "OK - Backend antwortet (HTTP $HTTP_STATUS)"
  recover_alert
else
  # PM2 Status prüfen
  PM2_STATUS="unbekannt"
  if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 list --no-color 2>/dev/null | grep -E "dojosoftware|online|stopped|errored" | head -5 || echo "pm2-fehler")
  fi

  # Zweiter Versuch nach 15 Sekunden (kurze Unterbrechungen ignorieren)
  sleep 15
  HTTP_STATUS2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 --connect-timeout 5 "$HEALTH_URL" 2>/dev/null)

  if [ "$HTTP_STATUS2" = "200" ]; then
    log "Kurzunterbrechung (erster Check: $HTTP_STATUS, zweiter: OK) — kein Alert"
    recover_alert
  else
    send_alert \
      "[KRITISCH] Dojosoftware Backend nicht erreichbar" \
      "Das Backend unter $HEALTH_URL antwortet nicht!

Zeitpunkt: $TIMESTAMP
HTTP-Status 1. Versuch: ${HTTP_STATUS:-keine Antwort}
HTTP-Status 2. Versuch: ${HTTP_STATUS2:-keine Antwort}

PM2-Status:
$PM2_STATUS

Mögliche Maßnahmen:
  ssh root@dojo.tda-intl.org -p 2222 -i ~/.ssh/id_ed25519_dojo_deploy
  pm2 status
  pm2 restart dojosoftware-backend
  pm2 logs dojosoftware-backend --lines 50

Log: $LOG_FILE"
  fi
fi
