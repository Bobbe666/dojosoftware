# DojoSoftware - Server Dokumentation

**Stand:** 13.02.2026 | **Status:** Produktivsystem (stabil)

---

## Zugangsdaten & Infrastruktur

### Server
| Parameter | Wert |
|-----------|------|
| OS | Debian 12 (Bookworm) |
| IP | 185.80.92.166 |
| SSH | Port 22 |
| Serverpfad | `/var/www/dojo-backend` / `/var/www/dojosoftware` |

### URLs
| Dienst | URL |
|--------|-----|
| Frontend | https://dojo.tda-intl.org |
| Backend API | https://dojo.tda-intl.org/api/... |
| Direkt (ohne Proxy) | http://185.80.92.166:3000 |

### Datenbank (MariaDB 10.11.x)
| Parameter | Wert |
|-----------|------|
| Datenbank | `dojo` |
| Root User | `root` |
| Root Passwort | `aaBobbe100aa$` |
| App User | `dojoUser@localhost` |
| App Passwort | `DojoServer2025!` |
| Charset | `utf8mb4_unicode_ci` |

### Git Repository
- **GitHub:** https://github.com/Bobbe666/dojosoftware.git
- **Branch:** main

---

## Sicherheit

### Verschlüsselung (AES-256-GCM)
Verschlüsselte Felder in der Datenbank:
- `dojo_banken.stripe_secret_key`
- `dojo_banken.stripe_publishable_key`
- `stripe_connect_accounts.access_token`
- `stripe_connect_accounts.refresh_token`

```
ENCRYPTION_KEY=f0df47671dea2a70ee1b6f21d8b506d60ec0c673320992d9ea72d85ebede8212
```
**KRITISCH:** Ohne diesen Schlüssel sind alle verschlüsselten Daten verloren!

### .env Backup
```bash
# Backup-Pfad
/root/backups/dojosoftware/.env.MASTER

# Wiederherstellung
cp /root/backups/dojosoftware/.env.MASTER /var/www/dojo-backend/.env
```

---

## Wartungsbefehle

### PM2
```bash
pm2 list                      # Status aller Prozesse
pm2 restart dojosoftware-backend
pm2 logs --lines 50           # Letzte 50 Zeilen
pm2 monit                     # Echtzeit-Monitoring
```

### Deployment
```bash
# Frontend
cd /var/www/dojosoftware/frontend
git pull && npm install && npm run build

# Backend
cd /var/www/dojo-backend
git pull && npm install
pm2 restart dojosoftware-backend
```

### nginx
```bash
nginx -t                      # Konfiguration testen
systemctl reload nginx        # Neu laden
```

### Datenbank
```bash
mysql -u root -p dojo         # MySQL CLI
mysqldump -u root -p dojo > backup.sql
```

### SSL
```bash
certbot certificates          # Zertifikate anzeigen
certbot renew --dry-run       # Renewal testen
```

---

## Automatische Jobs

### Backups (Cronjob täglich 00:01)
```
/var/www/dojosoftware/scripts/backup-database.sh
```
- **Pfad:** `/var/www/dojosoftware/backups/database/`
- **Rotation:** 7 Tage / 4 Wochen / 12 Monate

### PM2 Logrotate
- Max 10MB pro Log
- 7 Tage behalten
- Komprimiert

### SaaS Scheduled Jobs
| Job | Zeit | Funktion |
|-----|------|----------|
| Trial-Erinnerungen | 09:00 | 7/3/1 Tage vor Ablauf |
| Expired-Trial Update | 00:15 | Status auf "expired" |
| Payment-Failed Check | 10:00 | Zahlungserinnerungen |

---

## Deployment-Skripte
```bash
./scripts/build-and-deploy.sh     # Frontend bauen + deployen
./scripts/deploy-backend.sh       # Backend deployen (.env bleibt erhalten)
./scripts/rollback-frontend.sh    # Rollback aus Backup
```

---

## Systemstatus

| Komponente | Status |
|------------|--------|
| Server | Online |
| SSH | Port 22 |
| Firewall (UFW) | Aktiv |
| MariaDB | Lokal |
| Backend (PM2) | Port 3000 |
| Frontend (nginx) | HTTPS |
| SSL (Let's Encrypt) | Auto-Renewal |
| Backups | Täglich |
| Logrotate | Aktiv |

---

## Noch zu konfigurieren (optional)

1. **Uptime-Monitoring** - UptimeRobot / Pingdom
2. **Error-Tracking** - SENTRY_DSN in .env
3. **Stripe SaaS** - Price IDs + Webhook Secret
4. **Email-Server** - Credentials für Benachrichtigungen
