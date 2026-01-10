#!/bin/bash

echo "🚀 DojoSoftware Deployment-Check"
echo "================================="
echo ""

ERRORS=0
WARNINGS=0

# Prüfe Backend Environment
echo "📦 Backend Environment..."
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env fehlt!"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ backend/.env vorhanden"
    
    # Prüfe kritische Variables
    if ! grep -q "^JWT_SECRET=" backend/.env; then
        echo "❌ JWT_SECRET fehlt in .env"
        ERRORS=$((ERRORS + 1))
    else
        JWT_SECRET=$(grep "^JWT_SECRET=" backend/.env | cut -d'=' -f2)
        if [ ${#JWT_SECRET} -lt 32 ]; then
            echo "⚠️  JWT_SECRET ist zu kurz (< 32 Zeichen)"
            WARNINGS=$((WARNINGS + 1))
        else
            echo "✅ JWT_SECRET ist gesetzt und sicher"
        fi
    fi
    
    if ! grep -q "^DB_PASSWORD=" backend/.env; then
        echo "❌ DB_PASSWORD fehlt in .env"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ DB_PASSWORD ist gesetzt"
    fi
    
    if ! grep -q "^ALLOWED_ORIGINS=" backend/.env; then
        echo "⚠️  ALLOWED_ORIGINS fehlt in .env"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "✅ ALLOWED_ORIGINS ist gesetzt"
    fi
fi

echo ""
echo "📦 Dependencies..."
if [ -d "backend/node_modules" ]; then
    echo "✅ Backend node_modules vorhanden"
else
    echo "⚠️  Backend node_modules fehlt - führe 'npm install' aus"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend node_modules vorhanden"
else
    echo "⚠️  Frontend node_modules fehlt - führe 'npm install' aus"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🗄️  Datenbank..."
if [ -d "backups" ] && [ "$(ls -A backups)" ]; then
    LATEST_BACKUP=$(ls -t backups/*.sql | head -1)
    echo "✅ Backup vorhanden: $LATEST_BACKUP"
else
    echo "⚠️  Kein Backup gefunden - erstelle eines vor Deployment!"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "📝 Dokumentation..."
if [ -f "FINAL_IMPROVEMENTS_SUMMARY.md" ]; then
    echo "✅ Improvement Summary vorhanden"
else
    echo "⚠️  FINAL_IMPROVEMENTS_SUMMARY.md fehlt"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "SECURITY_SETUP.md" ]; then
    echo "✅ Security Setup Guide vorhanden"
else
    echo "⚠️  SECURITY_SETUP.md fehlt"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🧪 Tests..."
cd backend
if npm test --silent 2>&1 | grep -q "Tests:"; then
    echo "✅ Tests laufen"
else
    echo "⚠️  Tests können nicht ausgeführt werden"
    WARNINGS=$((WARNINGS + 1))
fi
cd ..

echo ""
echo "================================="
echo "📊 Zusammenfassung"
echo "================================="
echo "Fehler: $ERRORS"
echo "Warnungen: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ Deployment NICHT bereit! Behebe die Fehler."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  Deployment mit Vorsicht - prüfe die Warnungen!"
    exit 0
else
    echo "✅ Deployment bereit!"
    exit 0
fi
