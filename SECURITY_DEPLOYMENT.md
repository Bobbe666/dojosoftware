# Security-Verbesserungen Deployment Guide

## Zusammenfassung der Änderungen

1. **Security-Monitoring-System** - Erkennt SQL-Injection, XSS, Brute-Force und andere Angriffe
2. **Stärkeres JWT_SECRET** - 64 Zeichen statt 31
3. **Nginx Security Headers** - Zusätzliche Absicherung für Frontend

---

## 1. Migration auf Server ausführen

Die neue Security-Alerts Tabelle muss erstellt werden:

```bash
ssh root@dojo.tda-intl.org

# MySQL verbinden
mysql -u dojoUser -p dojo_mysql

# Migration ausführen (Inhalt von migrations/036_create_security_alerts.sql)
SOURCE /var/www/dojosoftware/backend/migrations/036_create_security_alerts.sql;
```

---

## 2. JWT_SECRET aktualisieren

**Neues starkes Secret (64 Zeichen):**
```
hcw+cEcLPgrLBopq2gguIQaE49d5nuJBqEPJteqI/189pzMuWEzeZMLqXsry4nDl
```

Auf dem Server in `/var/www/dojosoftware/backend/.env` aktualisieren:

```bash
ssh root@dojo.tda-intl.org

# .env bearbeiten
nano /var/www/dojosoftware/backend/.env

# JWT_SECRET ändern zu:
JWT_SECRET=hcw+cEcLPgrLBopq2gguIQaE49d5nuJBqEPJteqI/189pzMuWEzeZMLqXsry4nDl

# Backend neu starten
pm2 restart dojo-backend
```

**WICHTIG:** Nach Änderung des JWT_SECRET müssen alle Benutzer sich neu einloggen!

---

## 3. Nginx Security Headers hinzufügen

Die nginx-Konfiguration für dojo.tda-intl.org muss um Security Headers erweitert werden:

```bash
ssh root@dojo.tda-intl.org

# Nginx Config bearbeiten
sudo nano /etc/nginx/sites-available/dojo.tda-intl.org
```

**Folgende Headers im `server {}` Block hinzufügen:**

```nginx
server {
    listen 443 ssl http2;
    server_name dojo.tda-intl.org *.dojo.tda-intl.org;

    # ============ SECURITY HEADERS ============
    # XSS Protection (zusätzlich zu Helmet im Backend)
    add_header X-XSS-Protection "1; mode=block" always;

    # Verhindert MIME-Type Sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # Clickjacking Protection - nur eigene Domain darf einbetten
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Referrer Policy - verhindert Leak von URLs
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Permissions Policy (früher Feature-Policy)
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

    # HTTP Strict Transport Security (HSTS)
    # 1 Jahr gültig, inkludiert Subdomains
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Content Security Policy für Frontend
    # Erlaubt nur Ressourcen von eigener Domain + notwendige CDNs
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com; frame-ancestors 'self';" always;
    # ============ END SECURITY HEADERS ============

    # ... restliche Konfiguration
}
```

**Config testen und laden:**

```bash
# Konfiguration testen
sudo nginx -t

# Wenn erfolgreich, nginx neu laden
sudo systemctl reload nginx
```

---

## 4. Backend deployen

```bash
cd /var/www/dojosoftware

# Mit Backend-Flag deployen
yes j | ./deploy.sh --backend
```

---

## 5. Security-Dashboard testen

Nach dem Deployment unter: `https://dojo.tda-intl.org/dashboard/security`

Das Dashboard zeigt:
- Übersicht aller Security-Ereignisse
- Kritische Warnungen
- Blockierte IPs
- Statistiken nach Angriffstyp

---

## 6. Was wird erkannt?

| Angriffstyp | Schweregrad | Aktion |
|-------------|-------------|--------|
| SQL-Injection | Kritisch | Request blockiert, Admin benachrichtigt |
| XSS-Angriff | Hoch | Request blockiert, Admin benachrichtigt |
| Brute-Force Login | Hoch | Nach 5 Versuchen: Rate-Limit, nach 10: IP-Block |
| Path Traversal | Hoch | Request blockiert |
| CSRF-Verletzung | Hoch | Request blockiert |
| Rate-Limit überschritten | Mittel | Geloggt |
| Unbefugter Zugriff | Niedrig | Geloggt |

---

## 7. Automatische IP-Blockierung

- **10+ Alerts in 15 Minuten** → IP für 1 Stunde blockiert
- **20+ Alerts** → IP für 24 Stunden blockiert
- Blockierte IPs können manuell im Security-Dashboard entsperrt werden

---

## Rollback

Falls Probleme auftreten:

```bash
# Altes JWT_SECRET wiederherstellen
nano /var/www/dojosoftware/backend/.env
# Alten Wert einsetzen

# Backend neu starten
pm2 restart dojo-backend

# Security-Middleware deaktivieren (falls nötig)
# In server.js die securityMonitorMiddleware Zeilen auskommentieren
```
