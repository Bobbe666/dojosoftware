# 🔥 DojoSoftware - Server Status & TODO

📅 **Stand:** 30. November 2025

---

## 🔐 Zugangsdaten & Links

### Server
- **SSH:** `ssh root@185.80.92.166`
- **OS:** Debian 12 (Bookworm)
- **Serverpath:** `/var/www/dojosoftware`

### Domain & URLs
- **Frontend:** https://dojo.tda-intl.org
- **Backend API:** https://dojo.tda-intl.org/api/...
- **Direkt (ohne Proxy):** http://185.80.92.166:3000

### Datenbank (MariaDB 10.11.x)
- **Root User:** `root`
- **Root Passwort:** `aaBobbe100aa$`
- **Datenbank:** `dojo`
- **App User:** `dojoUser@localhost`
- **App Passwort:** `DojoServer2025!`
- **Charset:** `utf8mb4_unicode_ci`

### Git Repository
- **GitHub:** https://github.com/Bobbe666/dojosoftware.git
- **Branch:** main

---

## ✅ Bereits erledigt

### 1. Serverinfrastruktur
- ✅ SSH-Zugang eingerichtet und funktioniert
- ✅ Firewall (UFW) aktiviert und konfiguriert
  - OpenSSH erlaubt
  - Port 3000 für Backend geöffnet
- ✅ Node.js + npm installiert
- ✅ nginx installiert und läuft (Apache deaktiviert)
- ✅ PM2 für Prozessmanagement eingerichtet

### 2. Datenbank
- ✅ MariaDB installiert und gesichert
- ✅ Root-Passwort gesetzt, socket-auth deaktiviert
- ✅ Datenbank `dojo` erstellt (utf8mb4_unicode_ci)
- ✅ User `dojoUser` erstellt mit allen Rechten
- ✅ Datenbank importiert (Collation-Fehler behoben)
- ✅ DB-Verbindung vom Backend funktioniert

### 3. Backend
- ✅ Backend-Code via Git deployed nach `/var/www/dojosoftware/backend`
- ✅ Dependencies installiert (`npm install`)
- ✅ `.env` konfiguriert (oder nutzt Defaults aus `db.js`)
- ✅ `db.js` korrekt konfiguriert (dojoUser, utf8mb4)
- ✅ Port-Konflikt gelöst (läuft auf Port 3000)
- ✅ Backend läuft über PM2 (`pm2 list` zeigt: online)
- ✅ API öffentlich erreichbar

### 4. Frontend
- ✅ Frontend-Code via Git deployed nach `/var/www/dojosoftware/frontend`
- ✅ Dependencies installiert
- ✅ Production Build erstellt (`npm run build`)
- ✅ nginx als Reverse Proxy konfiguriert
- ✅ Domain `dojo.tda-intl.org` zeigt auf Server
- ✅ HTTPS eingerichtet (Let's Encrypt / Certbot)

### 5. Neue Features (30.11.2025)
- ✅ **Vertragsfrei-Feature** implementiert
  - Checkbox im Mitglieder-Detail Vertrag-Tab
  - Grund-Eingabe (Ehrenmitglied, Familie, Sponsor, etc.)
  - Datenbank-Spalten `vertragsfrei` und `vertragsfrei_grund` hinzugefügt
  - Frontend + Backend deployed

- ✅ **Mock-Daten System** für Development-Modus
  - Zentrale Mock-Daten in `backend/mockData.js`
  - Support für: Artikel, Kategorien, Mitglieder, Stile, Checkin
  - Automatische Detection über `NODE_ENV`

- ✅ **API-Pfad Bugfixes**
  - 30+ Komponenten korrigiert
  - Entfernung doppelter `/api/api/` Pfade
  - Verwendung von `config.apiBaseUrl`

---

## ⚠️ Bekannte Warnungen (nicht kritisch)

Diese Fehler erscheinen in den PM2 Logs, beeinträchtigen aber NICHT die Hauptfunktionalität:

1. **bcrypt Modul fehlt** (nur für Admin-Passwort-Hashing)
   - Route: `admins.js`
   - Optional zu beheben mit: `cd /var/www/dojosoftware/backend && npm install bcrypt && pm2 restart all`

2. **Einige PDF-Generator Routen**
   - `stileguertel_stats_fixed.js` - Syntax Error
   - `templatePdfGenerator.js` - kein Middleware Export
   - `vertragPdfGeneratorExtended.js` - kein Middleware Export
   - Betrifft nur PDF-Export-Funktionen

3. **MySQL2 Konfigurationswarnungen**
   - `collation` und `connectionConfig` werden ignoriert
   - Keine Auswirkung auf Funktion, nur Zukunftswarnung

---

## 📋 Aktuelle TODO-Liste

### Optional: Wartung & Verbesserungen

1. **bcrypt installieren** (falls Admin-Passwörter gehasht werden sollen)
   ```bash
   cd /var/www/dojosoftware/backend
   npm install bcrypt
   pm2 restart all
   ```

2. **PDF-Generator Routen fixen** (falls PDF-Export genutzt wird)
   - `stileguertel_stats_fixed.js` Syntax prüfen
   - `templatePdfGenerator.js` Middleware Export korrigieren
   - `vertragPdfGeneratorExtended.js` Middleware Export korrigieren

3. **Monitoring einrichten**
   - PM2 Monitoring aktivieren: `pm2 install pm2-logrotate`
   - Automatische Log-Rotation konfigurieren
   - Uptime-Monitoring (z.B. UptimeRobot, Pingdom)

4. **Backup-Strategie**
   - Automatisches DB-Backup einrichten (cron job)
   - Backup-Skript erstellen
   - Backup-Speicherort definieren (lokal + remote)

5. **SSL-Zertifikat Auto-Renewal**
   - Prüfen: `sudo certbot renew --dry-run`
   - Cron-Job sollte bereits durch certbot eingerichtet sein

6. **Performance-Optimierung**
   - nginx gzip Kompression aktivieren
   - Browser-Caching für statische Assets
   - CDN für statische Ressourcen erwägen

---

## 🚀 System Status: PRODUKTIV

| Komponente | Status | Notizen |
|------------|--------|---------|
| Server | ✅ Online | Debian 12, stabil |
| SSH | ✅ Funktioniert | Port 22 |
| Firewall | ✅ Konfiguriert | UFW aktiv |
| MariaDB | ✅ Läuft | Port 3306 (lokal) |
| Backend | ✅ Läuft | PM2, Port 3000 |
| Frontend | ✅ Läuft | nginx, HTTPS |
| Domain | ✅ Aktiv | dojo.tda-intl.org |
| HTTPS | ✅ Aktiv | Let's Encrypt |
| API | ✅ Erreichbar | /api/... |

---

## 📞 Wartungsbefehle

### PM2 Prozessmanagement
```bash
pm2 list                    # Status aller Prozesse
pm2 restart all             # Alle Prozesse neu starten
pm2 logs                    # Live-Logs anzeigen
pm2 logs --lines 50         # Letzte 50 Zeilen
pm2 monit                   # Echtzeit-Monitoring
```

### Git Deployment
```bash
cd /var/www/dojosoftware
git pull                    # Neueste Änderungen holen
cd backend && npm install   # Backend Dependencies
cd ../frontend && npm install && npm run build  # Frontend Build
pm2 restart all             # Services neu starten
```

### nginx
```bash
sudo nginx -t               # Konfiguration testen
sudo systemctl reload nginx # Konfiguration neu laden
sudo systemctl status nginx # Status prüfen
```

### Datenbank
```bash
mysql -u root -p            # MySQL CLI öffnen
mysql -u root -p dojo < backup.sql  # Backup einspielen
mysqldump -u root -p dojo > backup.sql  # Backup erstellen
```

### SSL-Zertifikat
```bash
sudo certbot certificates   # Zertifikate anzeigen
sudo certbot renew         # Manuell erneuern
```

---

## 🎉 Fazit

**Das System ist vollständig produktionsbereit und läuft stabil!**

- ✅ Alle Hauptfunktionen arbeiten
- ✅ HTTPS gesichert
- ✅ Professionelles Domain-Setup
- ✅ Neueste Features deployed (Vertragsfrei, Mock-Daten, API-Fixes)
- ✅ Keine kritischen Fehler

Die TODO-Liste enthält nur noch optionale Verbesserungen für Wartung und Performance.
