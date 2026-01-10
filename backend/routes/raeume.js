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
        const dojoId = req.tenant?.dojo_id || req.dojo_id;

        // Super-Admin (dojo_id = null): Kann Räume aller zentral verwalteten Dojos sehen
        // Normaler Admin: Muss dojo_id haben
        if (dojoId === undefined && !req.user) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { standort_id } = req.query; // Optional standort filter

        let query = `
            SELECT r.*, s.name as standort_name, s.farbe as standort_farbe
            FROM raeume r
            LEFT JOIN standorte s ON r.standort_id = s.standort_id
        `;
        let params = [];

        // Dojo-Filter: Super-Admin kann alle zentral verwalteten Dojos sehen
        if (dojoId === null || dojoId === undefined) {
            // Super-Admin: Nur zentral verwaltete Dojos (ohne separate Tenants)
            query += ` WHERE r.dojo_id NOT IN (
                SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL
            )`;
        } else {
            // Normaler Admin: Nur eigenes Dojo
            query += ' WHERE r.dojo_id = ?';
            params.push(dojoId);
        }

        // Add standort filter if provided
        if (standort_id && standort_id !== 'all') {
            query += ' AND r.standort_id = ?';
            params.push(standort_id);
        }

        query += ' ORDER BY r.reihenfolge ASC, r.name ASC';

        const raeume = await queryAsync(query, params);
        res.json({ success: true, data: raeume });
    } catch (err) {
        console.error('Fehler beim Abrufen der Räume:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/raeume - Neuen Raum erstellen
router.post('/', async (req, res) => {
    try {
        // Tenant check
        if (!req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { name, beschreibung, groesse, kapazitaet, farbe, aktiv, standort_id } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Raumname ist erforderlich' });
        }

        // Determine final standort_id
        let finalStandortId = standort_id;
        if (!finalStandortId) {
            // Get main location for this dojo
            const hauptstandort = await queryAsync(
                'SELECT standort_id FROM standorte WHERE dojo_id = ? AND ist_hauptstandort = TRUE LIMIT 1',
                [req.tenant.dojo_id]
            );
            if (hauptstandort.length === 0) {
                return res.status(500).json({ error: 'Kein Hauptstandort gefunden' });
            }
            finalStandortId = hauptstandort[0].standort_id;
        } else {
            // Validate that standort_id belongs to this dojo
            const standort = await queryAsync(
                'SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?',
                [standort_id, req.tenant.dojo_id]
            );
            if (standort.length === 0) {
                return res.status(400).json({ error: 'Ungültiger Standort' });
            }
        }

        // Höchste Reihenfolge ermitteln (pro dojo)
        const maxReihenfolge = await queryAsync(`
            SELECT MAX(reihenfolge) as max_reihenfolge FROM raeume WHERE dojo_id = ?
        `, [req.tenant.dojo_id]);
        const neueReihenfolge = (maxReihenfolge[0].max_reihenfolge || 0) + 1;

        const result = await queryAsync(`
            INSERT INTO raeume (name, beschreibung, groesse, kapazitaet, farbe, aktiv, reihenfolge, dojo_id, standort_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name.trim(),
            beschreibung || '',
            groesse || null,
            kapazitaet || null,
            farbe || '#4F46E5',
            aktiv !== false ? 1 : 0,
            neueReihenfolge,
            req.tenant.dojo_id,
            finalStandortId
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
                reihenfolge: neueReihenfolge,
                dojo_id: req.tenant.dojo_id,
                standort_id: finalStandortId
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
        // Tenant check
        if (!req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { id } = req.params;
        const { name, beschreibung, groesse, kapazitaet, farbe, aktiv, standort_id } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Raumname ist erforderlich' });
        }

        // Verify room belongs to this dojo
        const existingRaum = await queryAsync(
            'SELECT raum_id FROM raeume WHERE raum_id = ? AND dojo_id = ?',
            [id, req.tenant.dojo_id]
        );
        if (existingRaum.length === 0) {
            return res.status(404).json({ error: 'Raum nicht gefunden' });
        }

        // If standort_id is provided, validate it belongs to this dojo
        if (standort_id) {
            const standort = await queryAsync(
                'SELECT standort_id FROM standorte WHERE standort_id = ? AND dojo_id = ?',
                [standort_id, req.tenant.dojo_id]
            );
            if (standort.length === 0) {
                return res.status(400).json({ error: 'Ungültiger Standort' });
            }
        }

        let updateQuery = `
            UPDATE raeume
            SET name = ?, beschreibung = ?, groesse = ?, kapazitaet = ?, farbe = ?, aktiv = ?
        `;
        const params = [
            name.trim(),
            beschreibung || '',
            groesse || null,
            kapazitaet || null,
            farbe || '#4F46E5',
            aktiv !== false ? 1 : 0
        ];

        if (standort_id !== undefined) {
            updateQuery += ', standort_id = ?';
            params.push(standort_id);
        }

        updateQuery += ' WHERE raum_id = ? AND dojo_id = ?';
        params.push(id, req.tenant.dojo_id);

        await queryAsync(updateQuery, params);
        res.json({ success: true, message: 'Raum erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Raums:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/raeume/:id/reihenfolge - Reihenfolge ändern
router.put('/:id/reihenfolge', async (req, res) => {
    try {
        // Tenant check
        if (!req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { id } = req.params;
        const { neue_reihenfolge } = req.body;
        await queryAsync(`
            UPDATE raeume
            SET reihenfolge = ?
            WHERE raum_id = ? AND dojo_id = ?
        `, [neue_reihenfolge, id, req.tenant.dojo_id]);
        res.json({ success: true, message: 'Reihenfolge erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren der Reihenfolge:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/raeume/:id - Raum löschen
router.delete('/:id', async (req, res) => {
    try {
        // Tenant check
        if (!req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const { id } = req.params;

        // Verify room belongs to this dojo
        const existingRaum = await queryAsync(
            'SELECT raum_id FROM raeume WHERE raum_id = ? AND dojo_id = ?',
            [id, req.tenant.dojo_id]
        );
        if (existingRaum.length === 0) {
            return res.status(404).json({ error: 'Raum nicht gefunden' });
        }

        // Prüfen ob Raum in Kursen verwendet wird
        const kursVerwendung = await queryAsync(`
            SELECT COUNT(*) as count FROM kurse WHERE raum_id = ? AND dojo_id = ?
        `, [id, req.tenant.dojo_id]);

        if (kursVerwendung[0].count > 0) {
            return res.status(400).json({
                error: 'Raum kann nicht gelöscht werden',
                details: `Raum wird noch in ${kursVerwendung[0].count} Kurs(en) verwendet.`
            });
        }

        await queryAsync('DELETE FROM raeume WHERE raum_id = ? AND dojo_id = ?', [id, req.tenant.dojo_id]);
        res.json({ success: true, message: 'Raum erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen des Raums:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// GET /api/raeume/stats - Statistiken für Räume
router.get('/stats', async (req, res) => {
    try {
        // Tenant check
        if (!req.tenant?.dojo_id) {
            return res.status(403).json({ error: 'No tenant' });
        }

        const dojoId = req.tenant.dojo_id;
        const [
            gesamtRaeume,
            aktiveRaeume,
            raumVerwendung
        ] = await Promise.all([
            queryAsync('SELECT COUNT(*) as count FROM raeume WHERE dojo_id = ?', [dojoId]),
            queryAsync('SELECT COUNT(*) as count FROM raeume WHERE aktiv = 1 AND dojo_id = ?', [dojoId]),
            queryAsync(`
                SELECT
                    r.name,
                    COUNT(k.kurs_id) as anzahl_kurse
                FROM raeume r
                LEFT JOIN kurse k ON r.raum_id = k.raum_id AND k.dojo_id = ?
                WHERE r.aktiv = 1 AND r.dojo_id = ?
                GROUP BY r.raum_id, r.name
                ORDER BY anzahl_kurse DESC
            `, [dojoId, dojoId])
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