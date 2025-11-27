# 🚀 GitHub Actions Deployment Setup

Diese Anleitung hilft dir, das automatische Deployment einzurichten.

## 📋 Voraussetzungen

- SSH-Zugang zu deinem Server
- PM2 auf dem Server installiert
- Git Repository auf GitHub

## 🔐 GitHub Secrets einrichten

Um das automatische Deployment zu aktivieren, musst du folgende Secrets in deinem GitHub Repository hinterlegen:

### Schritt 1: GitHub Repository öffnen
1. Gehe zu: https://github.com/Bobbe666/dojosoftware
2. Klicke auf **Settings** (Einstellungen)
3. Im linken Menü: **Secrets and variables** → **Actions**
4. Klicke auf **New repository secret**

### Schritt 2: Secrets hinzufügen

Füge folgende Secrets hinzu (einer nach dem anderen):

#### 1. SERVER_HOST
- **Name:** `SERVER_HOST`
- **Value:** Die IP-Adresse oder Domain deines Servers
- **Beispiel:** `123.456.789.0` oder `dojo.example.com`

#### 2. SERVER_USER
- **Name:** `SERVER_USER`
- **Value:** Der SSH-Benutzername für deinen Server
- **Beispiel:** `root` oder `deploy` oder dein Server-Username

#### 3. SERVER_SSH_KEY
- **Name:** `SERVER_SSH_KEY`
- **Value:** Dein privater SSH-Schlüssel (komplett!)

**So findest du deinen SSH-Key:**
```bash
# Auf deinem lokalen Computer (Windows):
# Falls du schon einen SSH-Key hast:
type %USERPROFILE%\.ssh\id_rsa

# Falls du noch keinen hast, erstelle einen neuen:
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
# Dann den öffentlichen Key auf den Server kopieren:
type %USERPROFILE%\.ssh\id_rsa.pub | ssh [SERVER_USER]@[SERVER_HOST] "cat >> ~/.ssh/authorized_keys"
```

**WICHTIG:** Kopiere den KOMPLETTEN privaten Key inkl. der Zeilen:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...dein key...
-----END OPENSSH PRIVATE KEY-----
```

#### 4. SERVER_PORT (optional)
- **Name:** `SERVER_PORT`
- **Value:** SSH-Port (Standard: `22`)
- **Nur wenn dein SSH-Port NICHT 22 ist!**

## 🎯 PM2 Setup auf dem Server

Falls PM2 noch nicht läuft, verbinde dich mit dem Server und führe aus:

```bash
# Per SSH auf den Server verbinden
ssh [SERVER_USER]@[SERVER_HOST]

# Ins Projektverzeichnis wechseln
cd /var/www/dojosoftware

# PM2 Anwendung starten (falls noch nicht läuft)
cd backend
pm2 start server.js --name "dojosoftware"

# PM2 beim Systemstart automatisch starten
pm2 startup
pm2 save
```

## ✅ Deployment testen

Sobald die Secrets eingerichtet sind:

1. **Lokale Änderung machen** (z.B. eine Kommentarzeile in einer Datei)
2. **Committen und pushen:**
   ```bash
   git add .
   git commit -m "Test: Automatisches Deployment"
   git push origin main
   ```
3. **GitHub Actions beobachten:**
   - Gehe zu: https://github.com/Bobbe666/dojosoftware/actions
   - Hier siehst du den laufenden Deployment-Prozess

## 🔍 Troubleshooting

### Fehler: "Permission denied"
→ SSH-Key stimmt nicht oder ist nicht autorisiert auf dem Server

**Lösung:** Stelle sicher, dass der öffentliche Key in `~/.ssh/authorized_keys` auf dem Server liegt

### Fehler: "pm2 command not found"
→ PM2 ist nicht installiert oder nicht im PATH

**Lösung:**
```bash
npm install -g pm2
```

### Fehler: "Failed to connect"
→ SERVER_HOST oder SERVER_PORT falsch

**Lösung:** Überprüfe die Secrets in GitHub

## 📝 Was passiert beim Deployment?

1. ✅ Code wird von GitHub gepullt
2. ✅ Backup der aktuellen Version wird erstellt
3. ✅ Backend Dependencies werden installiert
4. ✅ Frontend wird gebaut (npm run build)
5. ✅ PM2 startet die Anwendung neu
6. ✅ Status wird überprüft

## 🎉 Fertig!

Ab jetzt wird bei jedem Push auf den `main`-Branch automatisch deployed!
