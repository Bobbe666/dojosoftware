# Deploy-Befehle

Server: `root@dojo.tda-intl.org` Port `2222`, Key `~/.ssh/id_ed25519_dojo_deploy`

## Frontend deployen

```bash
cd /Users/schreinersascha/dojosoftware/frontend && npm run build

# Beide Pfade deployen (IMMER beide!):
rsync -az dist/ root@dojo.tda-intl.org:/var/www/dojosoftware/frontend/
rsync -az dist/ root@dojo.tda-intl.org:/var/www/member-app/
```

**ACHTUNG:** `/var/www/checkin-app/` gehört NICHT zu Dojosoftware — niemals überschreiben!

## Backend deployen (einzelne Datei)

```bash
scp -i ~/.ssh/id_ed25519_dojo_deploy -P 2222 \
  backend/routes/DATEI.js \
  root@dojo.tda-intl.org:/var/www/dojo-backend/backend/routes/DATEI.js

ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org \
  "pm2 restart dojosoftware-backend"
```

Middleware-Dateien:
```bash
scp -i ~/.ssh/id_ed25519_dojo_deploy -P 2222 \
  backend/middleware/DATEI.js \
  root@dojo.tda-intl.org:/var/www/dojo-backend/backend/middleware/DATEI.js
```

## Migration auf Server ausführen

```bash
ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org \
  "mysql dojo < /dev/stdin" < backend/migrations/NNN_name.sql
```

## Backend lokal starten

```bash
cd /Users/schreinersascha/dojosoftware/backend && npm run dev
# nodemon server.js, Port 5001
```

## Frontend lokal starten

```bash
cd /Users/schreinersascha/dojosoftware/frontend && npm run dev
# Vite dev server, Port 5173, proxy → localhost:5001
```

## PM2-Status prüfen

```bash
ssh -i ~/.ssh/id_ed25519_dojo_deploy -p 2222 root@dojo.tda-intl.org "pm2 status"
# dojosoftware-backend: id=14, Port 5001
```

## Server-Pfade

| Was | Pfad auf Server |
|-----|-----------------|
| Backend-Source | `/var/www/dojo-backend/backend/` |
| Frontend (Haupt) | `/var/www/dojosoftware/frontend/` |
| Frontend (app.tda-vib.de) | `/var/www/member-app/` |
| Checkin-App (NICHT Dojo!) | `/var/www/checkin-app/` |
| Uploads/Belege | `/var/www/dojo-backend/backend/uploads/` |
