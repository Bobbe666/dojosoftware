// Backend/routes/zahlungszyklen.js - Zahlungsintervalle Verwaltung
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

// Initialisierung der Standard-Zahlungszyklen
const initializeDefaultCycles = async () => {
  try {
    // Prüfen ob bereits Zahlungszyklen existieren
    const existing = await queryAsync('SELECT COUNT(*) as count FROM zahlungszyklen');
    
    if (existing[0].count === 0) {
      const defaultCycles = [
        { name: 'Täglich', intervall_tage: 1, beschreibung: 'Tägliche Zahlung', aktiv: true },
        { name: 'Wöchentlich', intervall_tage: 7, beschreibung: 'Wöchentliche Zahlung', aktiv: true },
        { name: '14-tägig', intervall_tage: 14, beschreibung: '14-tägige Zahlung', aktiv: true },
        { name: 'Monatlich', intervall_tage: 30, beschreibung: 'Monatliche Zahlung', aktiv: true },
        { name: 'Vierteljährlich', intervall_tage: 90, beschreibung: 'Vierteljährliche Zahlung (3 Monate)', aktiv: true },
        { name: 'Halbjährlich', intervall_tage: 180, beschreibung: 'Halbjährliche Zahlung (6 Monate)', aktiv: true },
        { name: 'Jährlich', intervall_tage: 365, beschreibung: 'Jährliche Zahlung', aktiv: true }
      ];

      for (const cycle of defaultCycles) {
        await queryAsync(`
          INSERT INTO zahlungszyklen (name, intervall_tage, beschreibung, aktiv)
          VALUES (?, ?, ?, ?)
        `, [cycle.name, cycle.intervall_tage, cycle.beschreibung, cycle.aktiv]);
      }
    }
  } catch (error) {
    logger.error('Fehler beim Initialisieren der Zahlungszyklen:', { error: error });
  }
};

// Beim Laden des Moduls initialisieren
initializeDefaultCycles();

// GET /api/zahlungszyklen - Alle Zahlungszyklen abrufen
router.get('/', async (req, res) => {
    try {
        const zahlungszyklen = await queryAsync(`
            SELECT * FROM zahlungszyklen
            ORDER BY intervall_tage ASC
        `);
        res.json({ success: true, data: zahlungszyklen });
    } catch (err) {
        logger.error('Fehler beim Abrufen der Zahlungszyklen:', { error: err });
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/zahlungszyklen - Neuen Zahlungszyklus erstellen
router.post('/', async (req, res) => {
    try {
        const { name, intervall_tage, beschreibung, aktiv } = req.body;
        const result = await queryAsync(`
            INSERT INTO zahlungszyklen (name, intervall_tage, beschreibung, aktiv) 
            VALUES (?, ?, ?, ?)
        `, [name, intervall_tage, beschreibung || '', aktiv !== undefined ? aktiv : true]);
        res.json({ 
            success: true, 
            data: { 
                zyklus_id: result.insertId, 
                name,
                intervall_tage,
                beschreibung: beschreibung || '',
                aktiv: aktiv !== undefined ? aktiv : true
            } 
        });
    } catch (err) {
        logger.error('Fehler beim Erstellen des Zahlungszyklus:', { error: err });
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/zahlungszyklen/:id - Zahlungszyklus aktualisieren
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, intervall_tage, beschreibung, aktiv } = req.body;
        await queryAsync(`
            UPDATE zahlungszyklen 
            SET name = ?, intervall_tage = ?, beschreibung = ?, aktiv = ?
            WHERE zyklus_id = ?
        `, [name, intervall_tage, beschreibung || '', aktiv, id]);
        res.json({ success: true, message: 'Zahlungszyklus erfolgreich aktualisiert' });
    } catch (err) {
        logger.error('Fehler beim Aktualisieren des Zahlungszyklus:', { error: err });
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/zahlungszyklen/:id - Zahlungszyklus löschen
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Prüfen ob Zahlungszyklus in Verwendung ist
        const tarife = await queryAsync(`
            SELECT COUNT(*) as count FROM tarife WHERE zahlungszyklus_id = ?
        `, [id]);
        
        if (tarife[0].count > 0) {
            return res.status(400).json({ 
                error: 'Zahlungszyklus kann nicht gelöscht werden', 
                message: `Zahlungszyklus wird noch von ${tarife[0].count} Tarifen verwendet.` 
            });
        }
        
        await queryAsync('DELETE FROM zahlungszyklen WHERE zyklus_id = ?', [id]);
        res.json({ success: true, message: 'Zahlungszyklus erfolgreich gelöscht' });
    } catch (err) {
        logger.error('Fehler beim Löschen des Zahlungszyklus:', { error: err });
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

module.exports = router;