# DojoSoftware - Deployment Guide

## 🚀 Schnell-Start

Automatisches Deployment auf den Produktiv-Server:

```bash
# Option 1: Mit Commit-Message-Prompt
./deploy.sh

# Option 2: Mit eigener Commit-Message
./deploy.sh "Fix: Behebe Bug in Multi-Dojo-Verwaltung"

# Option 3: Quick Deploy (automatische Message)
./quick-deploy.sh

# Option 4: Nur Server-Deploy (kein Git Commit)
./deploy.sh --skip-commit
```

## 📋 Was macht das Deploy-Script?

### Lokal (auf deinem Mac):
1. ✅ Prüft auf lokale Änderungen
2. ✅ Staged alle Änderungen (`git add -A`)
3. ✅ Erstellt Commit mit deiner Message
4. ✅ Pusht zu GitHub (`git push origin main`)

### Auf dem Server (dojo.tda-intl.org):
5. ✅ Verbindet via SSH
6. ✅ Pullt neueste Änderungen (`git pull`)
7. ✅ Installiert Backend Dependencies
8. ✅ Installiert Frontend Dependencies
9. ✅ Erstellt Production Build (`npm run build`)
10. ✅ Startet Backend neu (PM2)
11. ✅ Reload Nginx
12. ✅ Zeigt Server-Status

## 🔧 Server-Konfiguration

Die Scripts verwenden folgende Server-Einstellungen:

```bash
SERVER_USER="root"
SERVER_HOST="dojo.tda-intl.org"
SERVER_PATH="/var/www/dojosoftware"
PM2_APP_NAME="dojosoftware"
```

Falls du andere Einstellungen benötigst, editiere `deploy.sh` Zeile 18-21.

## 📝 Workflow-Beispiele

### Normaler Entwicklungs-Workflow:

```bash
# 1. Lokale Änderungen machen
code src/components/DojosVerwaltung.jsx

# 2. Lokal testen
npm run dev

# 3. Wenn alles funktioniert, deployen
./deploy.sh "Feature: Verbessere Multi-Dojo-Verwaltung"

# ✅ Fertig! Code ist live auf dojo.tda-intl.org
```

### Schneller Bug-Fix:

```bash
# 1. Bug fixen
code src/components/Login.jsx

# 2. Quick Deploy
./quick-deploy.sh

# ✅ Fix ist sofort live
```

### Nur Server updaten (Code bereits gepusht):

```bash
./deploy.sh --skip-commit
```

## 🔍 Nach dem Deployment

1. **Öffne die Produktiv-URL:**
   ```
   https://dojo.tda-intl.org
   ```

2. **Hard-Refresh im Browser:**
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`

3. **Prüfe den Server-Status:**
   ```bash
   ssh root@dojo.tda-intl.org
   pm2 status
   pm2 logs dojosoftware
   ```

## ⚠️ Troubleshooting

### Deploy schlägt fehl?

**SSH-Verbindung prüfen:**
```bash
ssh root@dojo.tda-intl.org
```

**PM2 Status prüfen:**
```bash
ssh root@dojo.tda-intl.org "pm2 status"
```

**Backend Logs anschauen:**
```bash
ssh root@dojo.tda-intl.org "pm2 logs dojosoftware --lines 50"
```

**Nginx Status:**
```bash
ssh root@dojo.tda-intl.org "sudo systemctl status nginx"
```

### Frontend zeigt alte Version?

1. **Hard-Refresh im Browser** (Cmd+Shift+R)
2. **Cache leeren**
3. **Prüfe ob Build auf Server aktuell:**
   ```bash
   ssh root@dojo.tda-intl.org "ls -la /var/www/dojosoftware/frontend/dist/"
   ```

### Backend startet nicht?

```bash
# Auf dem Server:
ssh root@dojo.tda-intl.org
cd /var/www/dojosoftware/backend
pm2 restart dojosoftware
pm2 logs dojosoftware
```

## 🔐 SSH-Setup

Falls SSH-Keys noch nicht eingerichtet sind:

```bash
# 1. SSH-Key generieren (falls nicht vorhanden)
ssh-keygen -t ed25519 -C "dein@email.com"

# 2. Public Key zum Server hinzufügen
ssh-copy-id root@dojo.tda-intl.org

# 3. Testen
ssh root@dojo.tda-intl.org "echo 'SSH funktioniert!'"
```

## 📊 Status-Übersicht

Nach jedem Deployment siehst du:

```
╔════════════════════════════════════════════════╗
║          ✓ DEPLOYMENT ERFOLGREICH!            ║
╚════════════════════════════════════════════════╝

🌐 Produktiv-URL: https://dojo.tda-intl.org

📊 Server-Status:
┌─────────────────┬────┬─────────┬──────────┐
│ Name            │ id │ status  │ cpu      │
├─────────────────┼────┼─────────┼──────────┤
│ dojosoftware    │ 0  │ online  │ 0.2%     │
└─────────────────┴────┴─────────┴──────────┘
```

## 💡 Best Practices

1. **Immer lokal testen** vor dem Deploy
2. **Beschreibende Commit-Messages** verwenden
3. **Nach Deploy prüfen** ob alles funktioniert
4. **Bei Problemen** Logs anschauen (`pm2 logs`)
5. **Regelmäßig deployen** statt große Änderungen auf einmal

## 🎯 Nächste Schritte

Nach einem erfolgreichen Deployment:

1. ✅ Teste alle Änderungen auf dojo.tda-intl.org
2. ✅ Prüfe Browser-Console auf Fehler
3. ✅ Teste kritische Features (Login, Multi-Dojo, etc.)
4. ✅ Bei Problemen: Logs prüfen und ggf. zurückrollen

## 🔄 Rollback (falls nötig)

```bash
# Auf dem Server:
ssh root@dojo.tda-intl.org
cd /var/www/dojosoftware

# Zum vorherigen Commit zurück
git log --oneline -5  # Zeige letzte 5 Commits
git reset --hard COMMIT_HASH  # Ersetze COMMIT_HASH

# Frontend neu bauen
cd frontend && npm run build

# Backend neu starten
cd ../backend && pm2 restart dojosoftware
```

---

**Viel Erfolg beim Deployen! 🚀**
