// Backend/routes/laufzeiten.js - Laufzeiten Verwaltung
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

// Initialisierung der Standard-Laufzeiten
const initializeDefaultLaufzeiten = async () => {
  try {
    // Prüfen ob bereits Laufzeiten existieren
    const existing = await queryAsync('SELECT COUNT(*) as count FROM laufzeiten');
    
    if (existing[0].count === 0) {
      const defaultLaufzeiten = [
        { name: '1 Monat', monate: 1, beschreibung: 'Kurze Laufzeit - 1 Monat', aktiv: true },
        { name: '3 Monate', monate: 3, beschreibung: 'Mittlere Laufzeit - 3 Monate', aktiv: true },
        { name: '6 Monate', monate: 6, beschreibung: 'Längere Laufzeit - 6 Monate', aktiv: true },
        { name: '12 Monate', monate: 12, beschreibung: 'Jahresvertrag - 12 Monate', aktiv: true }
      ];

      for (const laufzeit of defaultLaufzeiten) {
        await queryAsync(`
          INSERT INTO laufzeiten (name, monate, beschreibung, aktiv)
          VALUES (?, ?, ?, ?)
        `, [laufzeit.name, laufzeit.monate, laufzeit.beschreibung, laufzeit.aktiv]);
      }
    }
  } catch (error) {
    console.error('Fehler beim Initialisieren der Laufzeiten:', error);
  }
};

// Beim Laden des Moduls initialisieren
initializeDefaultLaufzeiten();

// GET /api/laufzeiten - Alle Laufzeiten abrufen
router.get('/', async (req, res) => {
    try {
        const laufzeiten = await queryAsync(`
            SELECT * FROM laufzeiten
            ORDER BY monate ASC
        `);
        res.json({ success: true, data: laufzeiten });
    } catch (err) {
        console.error('Fehler beim Abrufen der Laufzeiten:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/laufzeiten - Neue Laufzeit erstellen
router.post('/', async (req, res) => {
    try {
        const { name, monate, beschreibung, aktiv } = req.body;
        const result = await queryAsync(`
            INSERT INTO laufzeiten (name, monate, beschreibung, aktiv) 
            VALUES (?, ?, ?, ?)
        `, [name, monate, beschreibung || '', aktiv !== undefined ? aktiv : true]);
        res.json({ 
            success: true, 
            data: { 
                laufzeit_id: result.insertId, 
                name,
                monate,
                beschreibung: beschreibung || '',
                aktiv: aktiv !== undefined ? aktiv : true
            } 
        });
    } catch (err) {
        console.error('Fehler beim Erstellen der Laufzeit:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/laufzeiten/:id - Laufzeit aktualisieren
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, monate, beschreibung, aktiv } = req.body;
        await queryAsync(`
            UPDATE laufzeiten 
            SET name = ?, monate = ?, beschreibung = ?, aktiv = ?
            WHERE laufzeit_id = ?
        `, [name, monate, beschreibung || '', aktiv, id]);
        res.json({ success: true, message: 'Laufzeit erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren der Laufzeit:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/laufzeiten/:id - Laufzeit löschen
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Prüfen ob Laufzeit in Verwendung ist
        const tarife = await queryAsync(`
            SELECT COUNT(*) as count FROM tarife WHERE laufzeit_id = ?
        `, [id]);
        
        if (tarife[0].count > 0) {
            return res.status(400).json({ 
                error: 'Laufzeit kann nicht gelöscht werden', 
                message: `Laufzeit wird noch von ${tarife[0].count} Tarifen verwendet.` 
            });
        }
        
        await queryAsync('DELETE FROM laufzeiten WHERE laufzeit_id = ?', [id]);
        res.json({ success: true, message: 'Laufzeit erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen der Laufzeit:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

module.exports = router;