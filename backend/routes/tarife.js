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
        // dojo_id aus verschiedenen Quellen extrahieren
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;

        console.log('📊 Tarife GET Request:', {
            tenant_dojo_id: req.tenant?.dojo_id,
            req_dojo_id: req.dojo_id,
            query_dojo_id: req.query.dojo_id,
            user_dojo_id: req.user?.dojo_id,
            final_dojo_id: dojoId,
            user_role: req.user?.role,
            user_exists: !!req.user,
            full_user: req.user ? JSON.stringify(req.user).substring(0, 200) : 'no user'
        });

        // Super-Admin (dojo_id = null): Kann Tarife aller zentral verwalteten Dojos sehen
        // Normaler Admin: Muss dojo_id haben
        if (!dojoId && !req.user) {
            return res.status(403).json({ error: 'No tenant' });
        }

        let query = 'SELECT * FROM tarife';
        let params = [];

        // Dojo-Filter: Super-Admin kann alle zentral verwalteten Dojos sehen
        const parsedDojoId = dojoId ? parseInt(dojoId, 10) : null;

        // User mit dojo_id=null gilt als Super-Admin (kann alle Dojos sehen)
        const isSuperAdmin = req.user?.role === 'super_admin' || req.user?.dojo_id === null;

        if (!parsedDojoId && isSuperAdmin) {
            // Super-Admin ohne spezifisches Dojo: Tarife ALLER zentral verwalteten Dojos
            // Keine WHERE-Klausel = alle Tarife
            console.log('📊 Super-Admin Modus: Zeige alle Tarife');
        } else if (parsedDojoId) {
            // Normaler Admin oder Super-Admin mit gewähltem Dojo: Nur dieses Dojo
            query += ' WHERE dojo_id = ?';
            params.push(parsedDojoId);
        } else {
            // Kein Dojo und kein Super-Admin
            return res.status(403).json({ error: 'No tenant' });
        }

        query += ' ORDER BY id ASC';

        console.log('📊 Tarife Query:', { query, params, parsedDojoId });

        const tarife = await queryAsync(query, params);

        console.log('📊 Tarife Result:', { count: tarife.length, firstItem: tarife[0] });

        res.json({ success: true, data: tarife });
    } catch (err) {
        console.error('Fehler beim Abrufen der Tarife:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/tarife - Neuen Tarif erstellen mit korrektem Schema
router.post('/', async (req, res) => {
    try {
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const {
            name,
            price_cents,
            aufnahmegebuehr_cents,
            currency,
            duration_months,
            billing_cycle,
            payment_method,
            active,
            mindestlaufzeit_monate,
            kuendigungsfrist_monate
        } = req.body;
        const result = await queryAsync(`
            INSERT INTO tarife (
                name, price_cents, aufnahmegebuehr_cents, currency, duration_months,
                billing_cycle, payment_method, active,
                mindestlaufzeit_monate, kuendigungsfrist_monate, dojo_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            price_cents,
            aufnahmegebuehr_cents || 4999,
            currency || 'EUR',
            duration_months,
            billing_cycle || 'MONTHLY',
            payment_method || 'SEPA',
            active !== undefined ? active : true,
            mindestlaufzeit_monate || duration_months,
            kuendigungsfrist_monate || 3,
            parsedDojoId
        ]);
        res.json({
            success: true,
            data: {
                id: result.insertId,
                name,
                price_cents,
                aufnahmegebuehr_cents: aufnahmegebuehr_cents || 4999,
                currency: currency || 'EUR',
                duration_months,
                billing_cycle: billing_cycle || 'MONTHLY',
                payment_method: payment_method || 'SEPA',
                active: active !== undefined ? active : true,
                mindestlaufzeit_monate: mindestlaufzeit_monate || duration_months,
                kuendigungsfrist_monate: kuendigungsfrist_monate || 3
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
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const { id } = req.params;
        const { name, price_cents, aufnahmegebuehr_cents, currency, duration_months, billing_cycle, payment_method, active } = req.body;
        await queryAsync(`
            UPDATE tarife
            SET name = ?, price_cents = ?, aufnahmegebuehr_cents = ?, currency = ?, duration_months = ?, mindestlaufzeit_monate = ?, billing_cycle = ?, payment_method = ?, active = ?
            WHERE id = ? AND dojo_id = ?
        `, [name, price_cents, aufnahmegebuehr_cents || 4999, currency, duration_months, duration_months, billing_cycle, payment_method, active, id, parsedDojoId]);
        res.json({ success: true, message: 'Tarif erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Tarifs:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/tarife/:id - Tarif löschen
router.delete('/:id', async (req, res) => {
    try {
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const { id } = req.params;
        // Note: vertraege table doesn't have tarif_id column in current schema
        // Skip usage check for now, can be added later if needed

        await queryAsync('DELETE FROM tarife WHERE id = ? AND dojo_id = ?', [id, parsedDojoId]);
        res.json({ success: true, message: 'Tarif erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen des Tarifs:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// PATCH /api/tarife/:id/archivieren - Tarif archivieren/entarchivieren
router.patch('/:id/archivieren', async (req, res) => {
    try {
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const { id } = req.params;
        const { ist_archiviert } = req.body;

        console.log('Archiviere Tarif:', { id, ist_archiviert, type: typeof ist_archiviert });

        // Boolean richtig konvertieren (MySQL erwartet 0 oder 1)
        const archiviert = ist_archiviert ? 1 : 0;

        const result = await queryAsync(`
            UPDATE tarife
            SET ist_archiviert = ?
            WHERE id = ? AND dojo_id = ?
        `, [archiviert, id, parsedDojoId]);

        console.log('Update Ergebnis:', result);

        res.json({
            success: true,
            message: ist_archiviert ? 'Tarif wurde archiviert' : 'Tarif wurde reaktiviert'
        });
    } catch (err) {
        console.error('Fehler beim Archivieren des Tarifs:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// =============================================
// RABATTE ENDPOINTS
// =============================================

// GET /api/tarife/rabatte - Alle Rabatte abrufen
router.get('/rabatte', async (req, res) => {
    try {
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        const parsedDojoId = dojoId ? parseInt(dojoId, 10) : null;

        // User mit dojo_id=null gilt als Super-Admin (kann alle Dojos sehen)
        const isSuperAdmin = req.user?.role === 'super_admin' || req.user?.dojo_id === null;

        if (!parsedDojoId && !isSuperAdmin) {
            return res.status(403).json({ error: 'No tenant' });
        }

        let query = `
            SELECT id AS rabatt_id, dojo_id, name, beschreibung, rabatt_prozent,
                   rabatt_typ, rabatt_betrag_cents,
                   gueltig_von, gueltig_bis, max_nutzungen, genutzt, aktiv, erstellt_am
            FROM rabatte`;
        let params = [];

        if (parsedDojoId) {
            query += ' WHERE dojo_id = ?';
            params.push(parsedDojoId);
        }
        // Super-Admin ohne Dojo: alle Rabatte (keine WHERE-Klausel)

        query += ' ORDER BY name ASC';

        const rabatte = await queryAsync(query, params);
        res.json({ success: true, data: rabatte });
    } catch (err) {
        console.error('Fehler beim Abrufen der Rabatte:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// POST /api/tarife/rabatte - Neuen Rabatt erstellen
router.post('/rabatte', async (req, res) => {
    try {
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const { name, beschreibung, rabatt_prozent, rabatt_typ, rabatt_betrag_cents, gueltig_von, gueltig_bis, max_nutzungen, aktiv } = req.body;
        const result = await queryAsync(`
            INSERT INTO rabatte (name, beschreibung, rabatt_prozent, rabatt_typ, rabatt_betrag_cents, gueltig_von, gueltig_bis, max_nutzungen, aktiv, dojo_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            beschreibung,
            rabatt_typ === 'prozent' ? rabatt_prozent : null,
            rabatt_typ || 'prozent',
            rabatt_typ === 'betrag' ? rabatt_betrag_cents : null,
            gueltig_von,
            gueltig_bis || null,  // null = unbegrenzt gültig
            max_nutzungen || null,
            aktiv,
            parsedDojoId
        ]);
        res.json({
            success: true,
            data: {
                rabatt_id: result.insertId,
                name,
                beschreibung,
                rabatt_prozent: rabatt_typ === 'prozent' ? rabatt_prozent : null,
                rabatt_typ: rabatt_typ || 'prozent',
                rabatt_betrag_cents: rabatt_typ === 'betrag' ? rabatt_betrag_cents : null,
                gueltig_von,
                gueltig_bis: gueltig_bis || null,
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
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const { id } = req.params;
        const { name, beschreibung, rabatt_prozent, rabatt_typ, rabatt_betrag_cents, gueltig_von, gueltig_bis, max_nutzungen, aktiv } = req.body;
        await queryAsync(`
            UPDATE rabatte
            SET name = ?, beschreibung = ?, rabatt_prozent = ?, rabatt_typ = ?, rabatt_betrag_cents = ?,
                gueltig_von = ?, gueltig_bis = ?, max_nutzungen = ?, aktiv = ?
            WHERE id = ? AND dojo_id = ?
        `, [
            name,
            beschreibung,
            rabatt_typ === 'prozent' ? rabatt_prozent : null,
            rabatt_typ || 'prozent',
            rabatt_typ === 'betrag' ? rabatt_betrag_cents : null,
            gueltig_von,
            gueltig_bis || null,
            max_nutzungen || null,
            aktiv,
            id,
            parsedDojoId
        ]);
        res.json({ success: true, message: 'Rabatt erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Rabatts:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

// DELETE /api/tarife/rabatte/:id - Rabatt löschen
router.delete('/rabatte/:id', async (req, res) => {
    try {
        // Tenant check - dojo_id aus verschiedenen Quellen
        const dojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;
        if (!dojoId) {
            return res.status(403).json({ error: 'No tenant' });
        }
        const parsedDojoId = parseInt(dojoId, 10);

        const { id } = req.params;
        // Vorerst ohne Verwendungscheck - kann später erweitert werden

        await queryAsync('DELETE FROM rabatte WHERE id = ? AND dojo_id = ?', [id, parsedDojoId]);
        res.json({ success: true, message: 'Rabatt erfolgreich gelöscht' });
    } catch (err) {
        console.error('Fehler beim Löschen des Rabatts:', err);
        res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
});

module.exports = router;