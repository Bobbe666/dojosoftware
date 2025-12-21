// Temporärer Migrations-Endpoint - NACH AUSFÜHRUNG LÖSCHEN!
const express = require('express');
const router = express.Router();
const db = require('../db');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// GET /api/migrate/add-ist-archiviert - Migration ausführen
router.get('/add-ist-archiviert', async (req, res) => {
    try {
        console.log('🗄️ Starte Migration: add_ist_archiviert_to_tarife');

        // Prüfe ob Spalte bereits existiert
        const checkColumn = await queryAsync(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'tarife'
            AND COLUMN_NAME = 'ist_archiviert'
        `);

        if (checkColumn.length > 0) {
            return res.json({
                success: true,
                message: 'Migration bereits ausgeführt - Spalte ist_archiviert existiert bereits'
            });
        }

        // Führe Migration aus
        await queryAsync(`
            ALTER TABLE tarife
            ADD COLUMN ist_archiviert BOOLEAN DEFAULT FALSE NOT NULL
            COMMENT 'TRUE = Alter Tarif, nicht mehr für neue Mitglieder verfügbar'
        `);

        await queryAsync(`
            CREATE INDEX idx_tarife_archiviert ON tarife(ist_archiviert)
        `);

        await queryAsync(`
            UPDATE tarife SET ist_archiviert = FALSE WHERE ist_archiviert IS NULL
        `);

        console.log('✅ Migration erfolgreich ausgeführt!');

        res.json({
            success: true,
            message: 'Migration erfolgreich ausgeführt! Spalte ist_archiviert wurde hinzugefügt.'
        });

    } catch (err) {
        console.error('❌ Fehler bei Migration:', err);
        res.status(500).json({
            success: false,
            error: 'Fehler bei der Migration',
            details: err.message
        });
    }
});

module.exports = router;
