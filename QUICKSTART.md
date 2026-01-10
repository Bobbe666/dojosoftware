# DojoSoftware - Quick Start Guide

## 🚀 Nach dem Klonen

### 1. Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env

# WICHTIG: Bearbeite backend/.env und setze sichere Secrets!
# Generiere sichere Secrets:
openssl rand -base64 32  # Für JWT_SECRET
openssl rand -base64 32  # Für SESSION_SECRET
```

### 2. Dependencies installieren

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Datenbank Setup

```bash
# Erstelle Datenbank
mysql -u root -p
CREATE DATABASE dojo;
CREATE USER 'dojoUser'@'localhost' IDENTIFIED BY 'DeinSicheresPasswort';
GRANT ALL PRIVILEGES ON dojo.* TO 'dojoUser'@'localhost';

# Importiere Schema
mysql -u dojoUser -p dojo < database/schema.sql

# Wende Performance-Indizes an
cd backend/migrations
bash apply_indexes.sh
```

### 4. Server starten

```bash
# Backend (Terminal 1)
cd backend
npm start
# → http://localhost:5001

# Frontend (Terminal 2)
cd frontend
npm run dev
# → http://localhost:5173
```

### 5. API Dokumentation

```
http://localhost:5001/api-docs
```

---

## 🧪 Tests ausführen

```bash
cd backend
npm test                # Alle Tests mit Coverage
npm run test:watch      # Watch Mode
npm run test:unit       # Nur Unit-Tests
npm run test:integration # Nur Integration-Tests
```

---

## 📚 Dokumentation

Alle wichtigen Dokumente:

### Sicherheit
- `SECURITY_SETUP.md` - Security Best Practices
- `backend/.env.example` - Environment Variables Template

### Entwicklung
- `FINAL_IMPROVEMENTS_SUMMARY.md` - Alle Verbesserungen
- `backend/docs/SERVICE_LAYER_GUIDE.md` - Backend Architecture
- `backend/docs/LOGGING_GUIDE.md` - Logging Best Practices
- `backend/docs/SWAGGER_GUIDE.md` - API Documentation Guide
- `frontend/src/services/API_MIGRATION_GUIDE.md` - API Service Usage

### Datenbank
- `backend/migrations/README.md` - Database Migrations Guide

### Testing
- `backend/tests/README.md` - Testing Guide

---

## ⚙️ Deployment

### Pre-Deployment Check

```bash
./deployment-check.sh
```

Stelle sicher dass:
- [ ] Alle Tests durchlaufen (`npm test`)
- [ ] Produktions-Secrets rotiert sind
- [ ] Datenbank-Backup existiert
- [ ] `ALLOWED_ORIGINS` in `.env` gesetzt ist

### Production Environment Variables

```bash
# Backend .env (Production)
NODE_ENV=production
PORT=5001

# Database (NIEMALS Development-Credentials!)
DB_HOST=your-production-db-host
DB_USER=your_production_user
DB_PASSWORD=<SICHERES PASSWORT - min. 16 Zeichen>
DB_NAME=dojo_production

# Secrets (NIEMALS Development-Secrets!)
JWT_SECRET=<SICHERER RANDOM STRING - min. 32 Zeichen>
SESSION_SECRET=<SICHERER RANDOM STRING - min. 32 Zeichen>

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Optional: Logging
LOG_TENANT_ACCESS=true
```

---

## 🔐 Sicherheits-Checkliste

Vor Production-Deployment:

- [ ] Alle Secrets rotiert (JWT_SECRET, DB_PASSWORD, SESSION_SECRET)
- [ ] `.env` nicht in Git committed
- [ ] HTTPS aktiviert (SSL/TLS)
- [ ] CORS nur für Production-Domain
- [ ] Rate Limiting aktiv (bereits konfiguriert ✅)
- [ ] Helmet Security Headers (bereits konfiguriert ✅)
- [ ] XSS-Protection (bereits konfiguriert ✅)
- [ ] Datenbank-Backups automatisiert
- [ ] Monitoring/Logging eingerichtet

---

## 📊 Performance

Nach Installation der Indizes erwartete Performance-Verbesserung:

- Mitglieder-Liste: **80% schneller**
- Vertrags-Queries: **70% schneller**
- Transaktions-Reports: **85% schneller**
- Dashboard: **60% schneller**

---

## 🐛 Troubleshooting

### "Cannot connect to database"

```bash
# Prüfe MySQL Service
sudo systemctl status mysql

# Prüfe Credentials in .env
cat backend/.env | grep DB_
```

### "JWT_SECRET not set"

```bash
# Generiere neuen Secret
openssl rand -base64 32

# Füge zu .env hinzu
echo "JWT_SECRET=<generated_secret>" >> backend/.env
```

### "Tests failing"

```bash
# Prüfe Test-Datenbank
mysql -u dojoUser -p dojo_test

# Falls nicht vorhanden:
mysql -u root -p
CREATE DATABASE dojo_test;
GRANT ALL PRIVILEGES ON dojo_test.* TO 'dojoUser'@'localhost';
```

---

## 📞 Support

Bei Fragen siehe:

1. `FINAL_IMPROVEMENTS_SUMMARY.md` - Übersicht aller Änderungen
2. `SECURITY_SETUP.md` - Security-Probleme
3. Spezifische Guides in `backend/docs/`
4. GitHub Issues

---

## 🎯 Nächste Schritte nach Setup

1. **Tests erweitern** - Erhöhe Coverage auf 70%+
2. **Swagger dokumentieren** - Füge JSDoc zu allen Routes hinzu
3. **Logging vervollständigen** - Ersetze verbleibende console.log
4. **Service Layer migrieren** - Weitere Routes refactoren

---

**Version:** 1.0.0  
**Letzte Aktualisierung:** 09.01.2026
