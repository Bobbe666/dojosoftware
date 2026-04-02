#!/bin/bash

# Lade Environment Variables
source ../.env

echo "🚀 Starte Index-Migration..."
echo ""
echo "📊 Datenbank: $DB_NAME"
echo "🏢 Host: $DB_HOST"
echo "👤 User: $DB_USER"
echo ""

# Führe Indizes aus (ignoriere Duplikat-Fehler)
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < add_performance_indexes_v2.sql 2>&1 | grep -v "Duplicate key name"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Indizes erfolgreich erstellt!"
    echo ""
    echo "📈 Prüfe vorhandene Indizes..."
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
        SELECT 
            TABLE_NAME,
            INDEX_NAME,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = '$DB_NAME'
          AND TABLE_NAME IN ('mitglieder', 'vertraege', 'transaktionen', 'pruefungen', 'anwesenheit', 'notifications', 'admins')
          AND INDEX_NAME LIKE 'idx_%'
        GROUP BY TABLE_NAME, INDEX_NAME
        ORDER BY TABLE_NAME, INDEX_NAME;
    "
else
    echo "❌ Fehler beim Erstellen der Indizes"
    exit 1
fi
