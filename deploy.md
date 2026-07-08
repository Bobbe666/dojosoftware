# Deploy-Befehle

Server: `root@dojo.tda-intl.org` Port `2222`, Key `~/.ssh/id_ed25519_dojo_deploy`

> **Deploy ist GIT-BASIERT.** Der laufende Backend-Prozess startet aus
> `/var/www/dojosoftware-source/` — **nicht** aus `/var/www/dojo-backend/`
> (alter, toter Pfad). Einzelne Dateien per scp dorthin zu kopieren bewirkt
> NICHTS. Immer `git push` → Server `git fetch && git reset --hard origin/main`
> → `pm2 restart`.

## Einfachster Weg: deploy.sh

```bash
cd /Users/schreinersascha/dojosoftware
./deploy.sh            # Frontend + Backend
./deploy.sh backend    # Nur Backend (git push → server pull → pm2 restart)
./deploy.sh frontend   # Nur Frontend (build → rsync in 2 Webroots)
```

## Backend manuell deployen

```bash
# 1. Lokal committen + pushen (nur was in git ist, wird deployed!)
git -C ~/dojosoftware add -A && git commit -m '...' && git push origin main

# 2. Server: fetch + hart auf origin/main + Backend neu starten
ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org "
  cd /var/www/dojosoftware-source &&
  git fetch origin main && git reset --hard origin/main &&
  pm2 restart dojosoftware-backend
"
```

**WICHTIG:** `git reset --hard origin/main` OHNE vorheriges `git fetch` nutzt den
veralteten lokalen Ref → springt NICHT auf den neuen Commit. Immer erst fetch.

## Frontend manuell deployen

```bash
cd /Users/schreinersascha/dojosoftware/frontend
rm -rf dist
VERSION=$(git -C ~/dojosoftware rev-parse --short HEAD)
CI=false VITE_BUILD_ID="$VERSION" npm run build

# Version stempeln (sw.js + version.json), damit die App die neue Version erkennt
node -e "const fs=require('fs'),p='dist/sw.js',v='$VERSION'; if(fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace(/Version: [^\n]+/,'Version: '+v)); fs.writeFileSync('dist/version.json',JSON.stringify({v}));"

# In ALLE DREI Webroots (deploy.sh macht das automatisch):
KEY=~/.ssh/id_ed25519_dojo_deploy
for W in /var/www/dojosoftware/ /var/www/member-app/ /var/www/dojosoftware/frontend/; do
  rsync -az --delete --exclude 'assets/' -e "ssh -p 2222 -i $KEY" dist/ root@dojo.tda-intl.org:$W
  rsync -az            -e "ssh -p 2222 -i $KEY" dist/assets/ root@dojo.tda-intl.org:${W}assets/
done
```

Gehashte Chunks in `assets/` bleiben stehen (kein `--delete`), damit offene
Tabs/PWAs ihre alten Chunks weiterladen können (kein „Importing module failed").

**ACHTUNG:** `/var/www/checkin-app/` gehört NICHT zu Dojosoftware — niemals überschreiben!

## Migration auf Server ausführen

```bash
ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org \
  "mysql dojo < /dev/stdin" < backend/migrations/NNN_name.sql
```

## Lokal starten

```bash
cd ~/dojosoftware/backend  && npm run dev   # nodemon server.js, Port 5001
cd ~/dojosoftware/frontend && npm run dev   # Vite, Port 5173, proxy → :5001
```

## PM2-Status prüfen

```bash
ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org "pm2 status"
# dojosoftware-backend: Port 5001, cwd /var/www/dojosoftware-source/backend
```

## Server-Pfade (Stand 2026-07-08)

| Was | Pfad auf Server |
|-----|-----------------|
| Backend-Source (LÄUFT hier, git-repo) | `/var/www/dojosoftware-source/backend/` |
| Frontend Webroot (dojo.tda-intl.org) | `/var/www/dojosoftware/` |
| Frontend Webroot (app.tda-vib.de) | `/var/www/member-app/` |
| Frontend Webroot (Wildcard `*.dojo.tda-intl.org`) | `/var/www/dojosoftware/frontend/` — **braucht denselben Build**, sonst 403 auf Subdomains |
| Checkin-App (NICHT Dojo!) | `/var/www/checkin-app/` |
| ALT/TOT — nicht mehr nutzen | `/var/www/dojo-backend/` |
