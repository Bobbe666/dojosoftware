# Deployment Notizen

## WICHTIG: .env NIEMALS überschreiben!

### Backend Deployment (KORREKT):
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'uploads' --exclude 'coverage' --exclude '.env' --exclude '.env.*' ./ root@dojo.tda-intl.org:/var/www/dojosoftware/backend/
```

### Frontend Deployment (KORREKT):
```bash
npm run build
rsync -avz dist/ root@dojo.tda-intl.org:/var/www/dojosoftware/ --exclude 'backend' --exclude 'frontend' --exclude 'node_modules' --exclude '.git' --exclude 'uploads' --exclude 'locales' --exclude '.env'
```

### NIEMALS:
- `--delete` Flag bei rsync verwenden ohne genaue Prüfung
- .env Dateien deployen (enthalten lokale Test-Konfiguration)

### Backups auf Server:
- /root/.env.dojosoftware.backup
- ENCRYPTION_KEY: f0df47671dea2a70ee1b6f21d8b506d60ec0c673320992d9ea72d85ebede8212
