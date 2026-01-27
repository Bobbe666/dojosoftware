// Migration Script: Prüfungswartezeiten zu Stile-Tabelle hinzufügen
// Ausführen mit: node backend/migrations/run_add_pruefungswartezeiten.js

const db = require('../db');

console.log('🚀 Starte Migration: Prüfungswartezeiten zu Stile-Tabelle...');

// Prüfe erst, ob die Spalten bereits existieren
const checkColumnsQuery = `
  SELECT COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dojo'
  AND TABLE_NAME = 'stile'
  AND COLUMN_NAME IN ('wartezeit_grundstufe', 'wartezeit_mittelstufe', 'wartezeit_oberstufe', 'wartezeit_schwarzgurt_traditionell')
`;

db.query(checkColumnsQuery, (err, existingColumns) => {
  if (err) {
    console.error('❌ Fehler beim Prüfen der Spalten:', err.message);
    process.exit(1);
  }

  const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);
  const columnsToAdd = [];

  if (!existingColumnNames.includes('wartezeit_grundstufe')) {
    columnsToAdd.push("ADD COLUMN wartezeit_grundstufe INT DEFAULT 3 COMMENT 'Wartezeit in Monaten für Grundstufen-Prüfungen'");
  }
  if (!existingColumnNames.includes('wartezeit_mittelstufe')) {
    columnsToAdd.push("ADD COLUMN wartezeit_mittelstufe INT DEFAULT 4 COMMENT 'Wartezeit in Monaten für Mittelstufen-Prüfungen'");
  }
  if (!existingColumnNames.includes('wartezeit_oberstufe')) {
    columnsToAdd.push("ADD COLUMN wartezeit_oberstufe INT DEFAULT 6 COMMENT 'Wartezeit in Monaten für Oberstufen-Prüfungen'");
  }
  if (!existingColumnNames.includes('wartezeit_schwarzgurt_traditionell')) {
    columnsToAdd.push("ADD COLUMN wartezeit_schwarzgurt_traditionell BOOLEAN DEFAULT FALSE COMMENT 'Ob traditionelle DAN-Wartezeiten verwendet werden'");
  }

  if (columnsToAdd.length === 0) {
    console.log('ℹ️  Alle Spalten existieren bereits. Keine Migration notwendig.');
    process.exit(0);
    return;
  }

  const alterTableQuery = `ALTER TABLE stile ${columnsToAdd.join(', ')}`;

  db.query(alterTableQuery, (err, result) => {
    if (err) {
      console.error('❌ Fehler bei der Migration:', err.message);
      process.exit(1);
    }

    console.log('✅ Migration erfolgreich abgeschlossen!');
    console.log('📊 Hinzugefügte Felder:', columnsToAdd.length);
    console.log('');
    console.log('Neue Felder hinzugefügt:');
    console.log('  - wartezeit_grundstufe (INT, Standard: 3 Monate)');
    console.log('  - wartezeit_mittelstufe (INT, Standard: 4 Monate)');
    console.log('  - wartezeit_oberstufe (INT, Standard: 6 Monate)');
    console.log('  - wartezeit_schwarzgurt_traditionell (BOOLEAN, Standard: FALSE)');

    process.exit(0);
  });
});
