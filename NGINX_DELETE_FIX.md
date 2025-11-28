# 🔧 Nginx DELETE-Methode erlauben

## Problem
Kurse können nicht gelöscht werden - Fehler: `405 Not Allowed` von Nginx

## Ursache
Nginx blockiert standardmäßig DELETE (und PUT) Methoden für bestimmte Pfade.

## Lösung

### Schritt 1: Nginx-Konfiguration finden
```bash
# Per SSH auf den Server verbinden
ssh [SERVER_USER]@[SERVER_HOST]

# Nginx-Konfiguration finden
ls /etc/nginx/sites-available/
# oder
ls /etc/nginx/conf.d/
```

### Schritt 2: Konfigurationsdatei bearbeiten
```bash
# Öffne die Nginx-Konfiguration für deine Seite
sudo nano /etc/nginx/sites-available/dojosoftware
# oder
sudo nano /etc/nginx/conf.d/dojosoftware.conf
```

### Schritt 3: API-Location-Block hinzufügen/anpassen

Füge folgenden Block in die `server { }` Sektion ein:

```nginx
server {
    listen 80;
    server_name deine-domain.de;  # Deine Domain anpassen

    # Frontend (React Build)
    location / {
        root /var/www/dojosoftware/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Erlaube nur GET für statische Dateien
        limit_except GET HEAD {
            deny all;
        }
    }

    # Backend API - WICHTIG: Alle HTTP-Methoden erlauben!
    location /api/ {
        proxy_pass http://localhost:3000/;  # Port anpassen falls nötig
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # WICHTIG: Alle HTTP-Methoden erlauben für API
        # (Keine limit_except Direktive hier!)
    }
}
```

**WICHTIG:** Der `/api/` Location-Block darf KEINE `limit_except` Direktive haben!

### Alternative Konfiguration (falls Backend direkt läuft)

Falls das Frontend und Backend auf unterschiedlichen Ports laufen:

```nginx
server {
    listen 80;
    server_name deine-domain.de;

    # Frontend
    location / {
        root /var/www/dojosoftware/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy - Alle Methoden erlauben
    location ~ ^/(api|kurse|mitglieder|trainer|raeume|dojos|tarife|banken|vertrag|notifications|anwesenheit|documents|statistics) {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Schritt 4: Nginx neu laden
```bash
# Konfiguration testen
sudo nginx -t

# Wenn OK, dann neu laden
sudo systemctl reload nginx

# oder
sudo service nginx reload
```

## Testen

Nach der Änderung sollte das Löschen funktionieren. Teste es im Browser:

1. Öffne die Kursverwaltung
2. Versuche einen Kurs zu löschen
3. Es sollte jetzt funktionieren!

## Debugging

Falls es immer noch nicht funktioniert:

```bash
# Nginx Error Log prüfen
sudo tail -f /var/log/nginx/error.log

# Während du einen Kurs zu löschen versuchst
```

## Hinweis zur Sicherheit

Die DELETE-Methode sollte nur für autorisierte Benutzer erlaubt sein. Stelle sicher, dass:
- ✅ Das Backend eine Authentifizierung hat
- ✅ Nur eingeloggte Admins Kurse löschen können
- ✅ Die Frontend-Authentifizierung funktioniert
