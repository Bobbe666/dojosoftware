# Security Setup Guide

## Erste Schritte nach dem Klonen

### 1. Umgebungsvariablen konfigurieren

**WICHTIG:** Die `.env` Datei enthält sensible Credentials und darf NIEMALS ins Git-Repo committed werden!

```bash
# Kopiere das Template
cp backend/.env.example backend/.env
```

### 2. Sichere Secrets generieren

#### JWT Secret
```bash
openssl rand -base64 32
```

Trage das Ergebnis in `backend/.env` ein:
```
JWT_SECRET=<generierter_key>
```

#### Session Secret (falls benötigt)
```bash
openssl rand -base64 32
```

### 3. Datenbank-Credentials setzen

Bearbeite `backend/.env`:
```
DB_HOST=localhost
DB_USER=<dein_db_user>
DB_PASSWORD=<dein_sicheres_passwort>
DB_NAME=dojo
```

## Produktions-Deployment

**NIEMALS** diese Fallback-Werte verwenden:
- ❌ `DojoServer2025!`
- ❌ `dojosoftware-secret-key-2024`

**IMMER**:
- ✅ Secrets aus Secret Manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Umgebungsvariablen vom Deployment-System
- ✅ Mindestens 32 Zeichen zufällige Strings

## Sicherheits-Checkliste

- [ ] `.env` ist in `.gitignore`
- [ ] `.env` nicht im Git-Repo committed
- [ ] Produktions-Secrets rotiert
- [ ] JWT_SECRET mindestens 32 Zeichen
- [ ] DB_PASSWORD ist stark (Min. 16 Zeichen, gemischt)
- [ ] Verschiedene Secrets für dev/staging/prod
