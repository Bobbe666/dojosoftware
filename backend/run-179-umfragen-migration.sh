#!/bin/bash
# Einmalige Migration: umfragen + umfrage_antworten Tabellen anlegen
# Ausführen auf dem Server: bash run-179-umfragen-migration.sh

set -a
source /var/www/dojosoftware-source/backend/.env
set +a

mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < /var/www/dojosoftware-source/backend/migrations/179_umfragen.sql \
  && echo "✅ Migration 179 erfolgreich" \
  || echo "❌ Migration 179 fehlgeschlagen"
