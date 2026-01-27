#!/bin/bash
# Einmaliges Migrations-Skript für ist_archiviert
# Datum: 2025-01-21

echo "🗄️ Führe Migration aus: add_ist_archiviert_to_tarife.sql"

# Lade .env Variablen
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Führe Migration aus
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < migrations/add_ist_archiviert_to_tarife.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration erfolgreich ausgeführt!"
else
  echo "❌ Migration fehlgeschlagen!"
  exit 1
fi
