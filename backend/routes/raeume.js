// Backend/routes/raeume.js - Raumverwaltung API
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

// GET /api/raeume - Alle Räume abrufen
router.get('/', async (req, res) => {
    try {
        const raeume = await queryAsync(`
            SELECT * FROM raeume
            ORDER BY reihenfolge ASC, name ASC
        `);
        res.json({ success: true, data: raeume });
    } catch (err) {
        console.error('Fehler beim Abrufen der Räume:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/raeume - Neuen Raum erstellen
router.post('/', async (req, res) => {
    try {
        const { name, beschreibung, groesse, kapazitaet, farbe, aktiv } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Raumname ist erforderlich' });
        }

        // Höchste Reihenfolge ermitteln
        const maxReihenfolge = await queryAsync(`
            SELECT MAX(reihenfolge) as max_reihenfolge FROM raeume
        `);
        const neueReihenfolge = (maxReihenfolge[0].max_reihenfolge || 0) + 1;

        const result = await queryAsync(`
            INSERT INTO raeume (name, beschreibung, groesse, kapazitaet, farbe, aktiv, reihenfolge)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            name.trim(),
            beschreibung || '',
            groesse || null,
            kapazitaet || null,
            farbe || '#4F46E5',
            aktiv !== false ? 1 : 0,
            neueReihenfolge
        ]);
        res.json({
            success: true,
            data: {
                raum_id: result.insertId,
                name,
                beschreibung,
                groesse,
                kapazitaet,
                farbe: farbe || '#4F46E5',
                aktiv: aktiv !== false ? 1 : 0,
                reihenfolge: neueReihenfolge
            }
        });
    } catch (err) {
        console.error('Fehler beim Erstellen des Raums:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/raeume/:id - Raum aktualisieren
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, beschreibung, groesse, kapazitaet, farbe, aktiv } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Raumname ist erforderlich' });
        }

        await queryAsync(`
            UPDATE raeume
            SET name = ?, beschreibung = ?, groesse = ?, kapazitaet = ?, farbe = ?, aktiv = ?
            WHERE raum_id = ?
        `, [
            name.trim(),
            beschreibung || '',
            groesse || null,
            kapazitaet || null,
            farbe || '#4F46E5',
            aktiv !== false ? 1 : 0,
            id
        ]);
        res.json({ success: true, message: 'Raum erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Raums:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/raeume/:id/reihenfolge - Reihenfolge ändern
router.put('/:id/reihenfolge', async (req, res) => {
    try {
        const { id } = req.params;
        const { neue_reihenfolge } = req.body;
        await queryAsync(`
            UPDATE raeume
            SET reihenfolge = ?
            WHERE raum_id = ?
        `, [neue_reihenfolge, id]);
        res.json({ success: true, message: 'Reihenfolge erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren der Reihenfolge:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/raeume/:id - Raum löschen
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Prüfen ob Raum in Kursen verwendet wird
        const kursVerwendung = await queryAsync(`
            SELECT COUNT(*) as count FROM kurse WHERE raum_id = ?
        `, [id]);

        if (kursVerwendung[0].count > 0) {
            return res.status(400).json({
                error: 'Raum kann nicht gelöscht werden',
                details: `Raum wird noch in ${kursVerwendung[0].count} Kurs(en) verwendet.`
            });
        }

        await queryAsync('DELETE FROM raeume WHERE raum_id = ?', [id]);
        res.json({ success: true, message: 'Raum erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen des Raums:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// GET /api/raeume/stats - Statistiken für Räume
router.get('/stats', async (req, res) => {
    try {
        const [
            gesamtRaeume,
            aktiveRaeume,
            raumVerwendung
        ] = await Promise.all([
            queryAsync('SELECT COUNT(*) as count FROM raeume'),
            queryAsync('SELECT COUNT(*) as count FROM raeume WHERE aktiv = 1'),
            queryAsync(`
                SELECT
                    r.name,
                    COUNT(k.kurs_id) as anzahl_kurse
                FROM raeume r
                LEFT JOIN kurse k ON r.raum_id = k.raum_id
                WHERE r.aktiv = 1
                GROUP BY r.raum_id, r.name
                ORDER BY anzahl_kurse DESC
            `)
        ]);

        const stats = {
            gesamtRaeume: gesamtRaeume[0].count,
            aktiveRaeume: aktiveRaeume[0].count,
            raumVerwendung: raumVerwendung
        };
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('Fehler beim Berechnen der Raum-Statistiken:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

module.exports = router;