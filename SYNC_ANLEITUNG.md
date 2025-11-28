# 🔄 Synchronisations-Anleitung

## Situation
Die meisten Änderungen wurden auf dem Server gemacht. Jetzt müssen wir:
- Server ➔ GitHub ➔ Lokaler Rechner synchronisieren

## ✅ Schritt-für-Schritt Anleitung

### Schritt 1: Server-Status prüfen

```bash
# Per SSH auf den Server verbinden
ssh [SERVER_USER]@[SERVER_HOST]

# Ins Projektverzeichnis wechseln
cd /var/www/dojosoftware

# Git Status prüfen
git status

# Geänderte Dateien anzeigen
git diff --name-only

# Nicht getrackte Dateien anzeigen
git ls-files --others --exclude-standard
```

### Schritt 2: Server-Änderungen committen (falls vorhanden)

```bash
# Alle Änderungen anzeigen
git status

# OPTION A: Alle Änderungen committen
git add .
git commit -m "Server-Änderungen synchronisieren"

# OPTION B: Nur bestimmte Dateien committen
git add backend/routes/beispiel.js
git add frontend/src/components/Beispiel.jsx
git commit -m "Beschreibung der Änderungen"

# Zum GitHub pushen
git push origin main
```

### Schritt 3: Auf lokalem Rechner die Änderungen holen

```bash
# Auf deinem Windows-Rechner (PowerShell/CMD)
cd C:\dojosoftware

# Änderungen von GitHub holen
git pull origin main

# Status prüfen
git status
```

### Schritt 4: Automatisches Deployment wird ausgelöst

Nach dem Push von Server ➔ GitHub wird automatisch:
- ✅ GitHub Actions ausgelöst
- ✅ Code wird zurück zum Server deployed
- ✅ PM2 startet die Anwendung neu

## 🚨 Wichtige Hinweise

### Dateien die NICHT committed werden sollten:

- ❌ `.env` Dateien (Umgebungsvariablen)
- ❌ `node_modules/` (Dependencies)
- ❌ `frontend/dist/` (Build-Ordner)
- ❌ `frontend/build/` (Build-Ordner)
- ❌ Log-Dateien
- ❌ Datenbank-Dumps mit echten Daten

Diese sind bereits in `.gitignore` eingetragen.

### Konflikte vermeiden

Falls du gleichzeitig auf Server UND lokal arbeitest:

1. **Immer vor Änderungen pullen:**
   ```bash
   git pull origin main
   ```

2. **Nach Änderungen sofort pushen:**
   ```bash
   git add .
   git commit -m "Beschreibung"
   git push origin main
   ```

### Bei Git-Konflikten

Falls es zu einem Konflikt kommt:

```bash
# Konflikt anzeigen
git status

# Datei manuell bearbeiten (Konfliktmarker entfernen)
nano datei-mit-konflikt.js

# Nach Lösung:
git add datei-mit-konflikt.js
git commit -m "Konflikt gelöst"
git push origin main
```

## 📋 Schnell-Checkliste

**Auf dem Server:**
- [ ] `cd /var/www/dojosoftware`
- [ ] `git status` - Status prüfen
- [ ] `git add .` - Änderungen hinzufügen (falls vorhanden)
- [ ] `git commit -m "Beschreibung"` - Committen
- [ ] `git push origin main` - Zu GitHub pushen

**Auf lokalem Rechner:**
- [ ] `cd C:\dojosoftware`
- [ ] `git pull origin main` - Änderungen holen
- [ ] `git status` - Sauber?

**Verifizierung:**
- [ ] GitHub Repository: https://github.com/Bobbe666/dojosoftware
- [ ] GitHub Actions: https://github.com/Bobbe666/dojosoftware/actions
- [ ] Server: Code ist aktuell nach Deployment

## 🎯 Empfohlener Workflow ab jetzt

**Für neue Änderungen:**

1. **Lokal entwickeln** (auf deinem Windows-Rechner)
2. **Testen** (lokal mit npm run dev)
3. **Committen und pushen** (git push origin main)
4. **Automatisches Deployment** wartet ab
5. **Auf Server testen** (Live-Version)

So bleibst du immer synchronisiert und hast alle Änderungen versioniert!

## 🔧 Nützliche Befehle

```bash
# Alle Änderungen seit letztem Commit anzeigen
git diff

# Änderungen rückgängig machen (VORSICHT!)
git checkout -- dateiname.js

# Letzten Commit rückgängig machen (behält Änderungen)
git reset --soft HEAD~1

# Remote-Status prüfen
git fetch origin
git status
```
