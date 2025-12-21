#!/bin/bash
# Skript zum Einrichten der Wartungsseite in Nginx
# Muss auf dem Server ausgeführt werden

echo "🔧 DojoSoftware - Wartungsseiten-Setup"
echo "======================================"
echo ""

# Prüfe ob Nginx läuft
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx ist nicht installiert!"
    exit 1
fi

# Backup der aktuellen Nginx-Konfiguration
NGINX_CONFIG="/etc/nginx/sites-available/dojosoftware"
BACKUP_CONFIG="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

if [ -f "$NGINX_CONFIG" ]; then
    echo "📦 Erstelle Backup: $BACKUP_CONFIG"
    sudo cp "$NGINX_CONFIG" "$BACKUP_CONFIG"
else
    echo "⚠️  Nginx-Konfiguration nicht gefunden: $NGINX_CONFIG"
    echo "Bitte passe den Pfad im Skript an oder erstelle die Konfiguration manuell."
    exit 1
fi

# Prüfe ob error_page bereits existiert
if grep -q "error_page.*maintenance.html" "$NGINX_CONFIG"; then
    echo "✅ Wartungsseiten-Konfiguration bereits vorhanden!"
    echo "Keine Änderung nötig."
    exit 0
fi

echo ""
echo "📝 Füge Wartungsseiten-Konfiguration hinzu..."
echo ""

# Erstelle temporäre Datei mit der neuen Konfiguration
cat > /tmp/nginx_maintenance_snippet.conf << 'EOF'

    # ========================================
    # WARTUNGSSEITE BEI DEPLOYMENTS
    # Zeigt benutzerfreundliche Seite statt 500-Fehler
    # ========================================
    error_page 500 502 503 504 /maintenance.html;
    location = /maintenance.html {
        root /var/www/dojosoftware/frontend/dist;
        internal;
    }
EOF

# Füge die Konfiguration vor der ersten "location /" Zeile ein
sudo sed -i '/location \/ {/i\    # ========================================\n    # WARTUNGSSEITE BEI DEPLOYMENTS\n    # Zeigt benutzerfreundliche Seite statt 500-Fehler\n    # ========================================\n    error_page 500 502 503 504 /maintenance.html;\n    location = /maintenance.html {\n        root /var/www/dojosoftware/frontend/dist;\n        internal;\n    }\n' "$NGINX_CONFIG"

# Füge proxy_intercept_errors zu allen location /api/ Blöcken hinzu
if grep -q "location /api/" "$NGINX_CONFIG"; then
    if ! grep -A 10 "location /api/" "$NGINX_CONFIG" | grep -q "proxy_intercept_errors"; then
        echo "📝 Füge proxy_intercept_errors zu /api/ Location hinzu..."
        sudo sed -i '/location \/api\/ {/a\        proxy_intercept_errors on;' "$NGINX_CONFIG"
    fi
fi

echo "✅ Konfiguration aktualisiert!"
echo ""

# Teste Nginx-Konfiguration
echo "🧪 Teste Nginx-Konfiguration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx-Konfiguration ist gültig!"
    echo ""

    # Nginx neu laden
    echo "🔄 Lade Nginx neu..."
    sudo systemctl reload nginx

    if [ $? -eq 0 ]; then
        echo "✅ Nginx erfolgreich neu geladen!"
        echo ""
        echo "🎉 Setup abgeschlossen!"
        echo ""
        echo "Die Wartungsseite wird jetzt automatisch angezeigt, wenn:"
        echo "  - Der Backend-Server gestoppt wird (Deployment)"
        echo "  - Ein 500/502/503/504 Fehler auftritt"
        echo ""
        echo "Beim nächsten Deployment siehst du statt des Fehlers eine"
        echo "benutzerfreundliche Wartungsseite mit Countdown-Timer."
    else
        echo "❌ Fehler beim Neuladen von Nginx!"
        echo "Stelle die Backup-Konfiguration wieder her:"
        echo "  sudo cp $BACKUP_CONFIG $NGINX_CONFIG"
        echo "  sudo systemctl reload nginx"
        exit 1
    fi
else
    echo "❌ Nginx-Konfiguration hat Fehler!"
    echo ""
    sudo nginx -t
    echo ""
    echo "Stelle die Backup-Konfiguration wieder her:"
    echo "  sudo cp $BACKUP_CONFIG $NGINX_CONFIG"
    exit 1
fi
