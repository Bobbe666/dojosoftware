# Nginx Wartungsseiten-Konfiguration

## Anleitung: Benutzerfreundliche Wartungsseite bei Deployments

Diese Konfiguration zeigt eine schöne Wartungsseite anstelle von "500 Internal Server Error" während Deployments.

## Schritt 1: Wartungsseite bereitstellen

Die Wartungsseite befindet sich in: `frontend/public/maintenance.html`

Nach dem Build wird sie automatisch nach `frontend/dist/maintenance.html` kopiert.

## Schritt 2: Nginx-Konfiguration anpassen

Füge diese Zeilen in deine Nginx-Konfiguration für die DojoSoftware-Site ein:

```nginx
server {
    listen 80;
    server_name dojo.tda-intl.org;

    # Root-Verzeichnis für statische Dateien (Frontend)
    root /var/www/dojosoftware/frontend/dist;
    index index.html;

    # Wartungsseite bei Server-Fehlern anzeigen
    error_page 500 502 503 504 /maintenance.html;
    location = /maintenance.html {
        root /var/www/dojosoftware/frontend/dist;
        internal;
    }

    # Frontend - alle Anfragen an index.html leiten (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API-Anfragen an Backend weiterleiten
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Wenn Backend nicht erreichbar, zeige Wartungsseite
        proxy_intercept_errors on;
    }
}
```

## Schritt 3: Nginx neu laden

```bash
sudo nginx -t  # Konfiguration testen
sudo systemctl reload nginx  # Nginx neu laden
```

## Was passiert jetzt?

### Während des Deployments:
1. PM2 stoppt den Backend-Server
2. Nginx erkennt, dass Backend nicht erreichbar ist (502/503)
3. Nginx zeigt automatisch `/maintenance.html` an
4. Nach ca. 1-2 Minuten ist das Deployment fertig
5. Backend startet neu
6. Wartungsseite verschwindet automatisch

### Vorteile:
- ✅ Keine hässlichen 500-Fehler mehr
- ✅ Benutzer wissen, was los ist
- ✅ Automatischer Reload nach 2 Minuten
- ✅ Countdown-Timer zeigt verbleibende Zeit
- ✅ Professionelles Erscheinungsbild

## Alternative: Manuelle Wartungsseite (optional)

Falls du die Seite manuell aktivieren möchtest:

```bash
# Wartungsmodus aktivieren
sudo touch /var/www/dojosoftware/MAINTENANCE_MODE

# Wartungsmodus deaktivieren
sudo rm /var/www/dojosoftware/MAINTENANCE_MODE
```

Dann in Nginx:

```nginx
location / {
    # Prüfe ob Wartungsmodus aktiv
    if (-f /var/www/dojosoftware/MAINTENANCE_MODE) {
        return 503;
    }
    try_files $uri $uri/ /index.html;
}
```
