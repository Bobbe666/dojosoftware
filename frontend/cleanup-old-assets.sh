#!/bin/bash
# Script zum Löschen alter Asset-Dateien nach dem Deployment

echo "🧹 Bereinige alte Asset-Dateien..."

cd /Users/schreinersascha/dojosoftware/frontend

# Nach dem Build, vor dem rsync
if [ -d "dist/assets" ]; then
    # Für jede Komponente behalte nur die neueste Datei
    for component in $(ls dist/assets/*.js | sed 's/-[^-]*\.js$//' | sort -u); do
        component_name=$(basename "$component")
        # Finde alle Dateien für diese Komponente
        files=$(ls dist/assets/${component_name}-*.js 2>/dev/null | sort -t'-' -k2 -r)
        
        if [ ! -z "$files" ]; then
            # Behalte nur die erste (neueste) Datei
            keep_file=$(echo "$files" | head -1)
            echo "✅ Behalte: $(basename $keep_file)"
            
            # Lösche alle anderen
            echo "$files" | tail -n +2 | while read old_file; do
                if [ -f "$old_file" ]; then
                    echo "🗑️  Lösche alte Datei: $(basename $old_file)"
                    rm "$old_file"
                fi
            done
        fi
    done
    
    echo "✅ Bereinigung abgeschlossen"
else
    echo "❌ dist/assets Verzeichnis nicht gefunden"
    exit 1
fi
