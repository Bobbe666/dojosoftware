// Backend/routes/tarife.js - Erweiterte Tarif- und Rabatt-Verwaltung
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

// GET /api/tarife - Alle Tarife abrufen (fallback zu altem Schema wenn nötig)
router.get('/', async (req, res) => {
    try {
        // Erst versuchen ob erweiterte Tabellen existieren
        // Einfache Abfrage mit korrektem Schema
        const tarife = await queryAsync(`
            SELECT *
            FROM tarife
            ORDER BY id ASC
        `);
        res.json({ success: true, data: tarife });
    } catch (err) {
        console.error('Fehler beim Abrufen der Tarife:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/tarife - Neuen Tarif erstellen mit korrektem Schema
router.post('/', async (req, res) => {
    try {
        const {
            name,
            price_cents,
            currency,
            duration_months,
            billing_cycle,
            payment_method,
            active
        } = req.body;
        const result = await queryAsync(`
            INSERT INTO tarife (
                name, price_cents, currency, duration_months,
                billing_cycle, payment_method, active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            price_cents,
            currency || 'EUR',
            duration_months,
            billing_cycle || 'monthly',
            payment_method || 'bank_transfer',
            active !== undefined ? active : true
        ]);
        res.json({
            success: true,
            data: {
                id: result.insertId,
                name,
                price_cents,
                currency: currency || 'EUR',
                duration_months,
                billing_cycle: billing_cycle || 'monthly',
                payment_method: payment_method || 'bank_transfer',
                active: active !== undefined ? active : true
            }
        });
    } catch (err) {
        console.error('Fehler beim Erstellen des Tarifs:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/tarife/:id - Tarif aktualisieren
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price_cents, currency, duration_months, billing_cycle, payment_method, active } = req.body;
        await queryAsync(`
            UPDATE tarife
            SET name = ?, price_cents = ?, currency = ?, duration_months = ?, mindestlaufzeit_monate = ?, billing_cycle = ?, payment_method = ?, active = ?
            WHERE id = ?
        `, [name, price_cents, currency, duration_months, duration_months, billing_cycle, payment_method, active, id]);
        res.json({ success: true, message: 'Tarif erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Tarifs:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/tarife/:id - Tarif löschen
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Note: vertraege table doesn't have tarif_id column in current schema
        // Skip usage check for now, can be added later if needed

        await queryAsync('DELETE FROM tarife WHERE id = ?', [id]);
        res.json({ success: true, message: 'Tarif erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen des Tarifs:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// =============================================
// RABATTE ENDPOINTS
// =============================================

// GET /api/tarife/rabatte - Alle Rabatte abrufen
router.get('/rabatte', async (req, res) => {
    try {
        const rabatte = await queryAsync(`
            SELECT * FROM rabatte
            ORDER BY name ASC
        `);
        res.json({ success: true, data: rabatte });
    } catch (err) {
        console.error('Fehler beim Abrufen der Rabatte:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/tarife/rabatte - Neuen Rabatt erstellen
router.post('/rabatte', async (req, res) => {
    try {
        const { name, beschreibung, rabatt_prozent, gueltig_von, gueltig_bis, max_nutzungen, aktiv } = req.body;
        const result = await queryAsync(`
            INSERT INTO rabatte (name, beschreibung, rabatt_prozent, gueltig_von, gueltig_bis, max_nutzungen, aktiv) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [name, beschreibung, rabatt_prozent, gueltig_von, gueltig_bis, max_nutzungen || null, aktiv]);
        res.json({ 
            success: true, 
            data: { 
                rabatt_id: result.insertId, 
                name, 
                beschreibung, 
                rabatt_prozent, 
                gueltig_von, 
                gueltig_bis, 
                max_nutzungen: max_nutzungen || null, 
                aktiv,
                genutzt: 0
            } 
        });
    } catch (err) {
        console.error('Fehler beim Erstellen des Rabatts:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PUT /api/tarife/rabatte/:id - Rabatt aktualisieren
router.put('/rabatte/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, beschreibung, rabatt_prozent, gueltig_von, gueltig_bis, max_nutzungen, aktiv } = req.body;
        await queryAsync(`
            UPDATE rabatte 
            SET name = ?, beschreibung = ?, rabatt_prozent = ?, gueltig_von = ?, gueltig_bis = ?, max_nutzungen = ?, aktiv = ?
            WHERE rabatt_id = ?
        `, [name, beschreibung, rabatt_prozent, gueltig_von, gueltig_bis, max_nutzungen || null, aktiv, id]);
        res.json({ success: true, message: 'Rabatt erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Rabatts:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/tarife/rabatte/:id - Rabatt löschen
router.delete('/rabatte/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Vorerst ohne Verwendungscheck - kann später erweitert werden
        
        await queryAsync('DELETE FROM rabatte WHERE rabatt_id = ?', [id]);
        res.json({ success: true, message: 'Rabatt erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen des Rabatts:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

module.exports = router;