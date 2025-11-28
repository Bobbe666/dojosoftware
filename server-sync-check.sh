#!/bin/bash
# Server-Sync-Check Script
# Dieses Script zeigt dir den Status auf dem Server

echo "🔍 Prüfe Git-Status auf dem Server..."
echo "============================================"
echo ""

# Aktuelles Verzeichnis anzeigen
echo "📂 Aktuelles Verzeichnis:"
pwd
echo ""

# Git Status
echo "📊 Git Status:"
git status
echo ""

# Nicht getrackte Dateien
echo "📄 Nicht getrackte Dateien:"
git ls-files --others --exclude-standard
echo ""

# Geänderte Dateien
echo "✏️ Geänderte Dateien:"
git diff --name-only
echo ""

# Gestashte Änderungen
echo "💾 Gestashte Änderungen:"
git stash list
echo ""

# Letzte Commits
echo "📜 Letzte 5 Commits:"
git log --oneline -5
echo ""

# Remote-Vergleich
echo "🔄 Vergleich mit Remote (origin/main):"
git fetch origin
git log HEAD..origin/main --oneline
if [ $? -eq 0 ]; then
    echo "✅ Server ist auf dem gleichen Stand wie GitHub"
else
    echo "⚠️ Es gibt Unterschiede zwischen Server und GitHub"
fi
echo ""

# Lokale Commits die noch nicht gepusht wurden
echo "📤 Lokale Commits die noch nicht auf GitHub sind:"
git log origin/main..HEAD --oneline
echo ""

echo "============================================"
echo "✅ Check abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "1. Falls es ungepushte Änderungen gibt: git push origin main"
echo "2. Falls es nur lokale Änderungen gibt: git add . && git commit && git push"
echo "3. Falls alles sauber ist: Nichts zu tun!"
