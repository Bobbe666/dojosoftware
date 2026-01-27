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

// Hilfsfunktion: ISO-Datum zu MySQL-Date konvertieren (YYYY-MM-DD)
const parseDate = (dateValue) => {
  if (!dateValue) return null;
  // Falls schon im richtigen Format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  // ISO-Format oder anderes Format parsen
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

// GET /api/tarife - Alle Tarife abrufen (fallback zu altem Schema wenn nötig)
router.get('/', async (req, res) => {
    try {
        // dojo_id aus verschiedenen Quellen extrahieren
        const rawDojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;

        console.log('📊 Tarife GET Request:', {
            tenant_dojo_id: req.tenant?.dojo_id,
            req_dojo_id: req.dojo_id,
            query_dojo_id: req.query.dojo_id,
            user_dojo_id: req.user?.dojo_id,
            final_dojo_id: rawDojoId,
            user_role: req.user?.role,
            user_exists: !!req.user,
            full_user: req.user ? JSON.stringify(req.user).substring(0, 200) : 'no user'
        });

        // Super-Admin (dojo_id = null): Kann Tarife aller zentral verwalteten Dojos sehen
        // Normaler Admin: Muss dojo_id haben
        if (!rawDojoId && !req.user) {
            return res.status(403).json({ error: 'No tenant' });
        }

        let query = 'SELECT * FROM tarife';
        let params = [];

        // Prüfen ob "alle Dojos" ausgewählt wurde
        const isAllDojos = rawDojoId === 'all' || rawDojoId === null || rawDojoId === undefined;
        const parsedDojoId = isAllDojos ? null : parseInt(rawDojoId, 10);

        // User mit dojo_id=null gilt als Super-Admin (kann alle Dojos sehen)
        const isSuperAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin' || req.user?.dojo_id === null;

        if (isAllDojos && isSuperAdmin) {
            // Super-Admin mit "Alle Dojos": Tarife ALLER Dojos anzeigen
            // Keine WHERE-Klausel = alle Tarife
            console.log('📊 Alle Dojos Modus: Zeige alle Tarife');
        } else if (parsedDojoId && !isNaN(parsedDojoId)) {
            // Spezifisches Dojo ausgewählt: Nur dieses Dojo
            query += ' WHERE dojo_id = ?';
            params.push(parsedDojoId);
        } else if (isSuperAdmin) {
            // Super-Admin ohne spezifisches Dojo: Alle Tarife
            console.log('📊 Super-Admin Modus: Zeige alle Tarife');
        } else {
            // Kein Dojo und kein Super-Admin
            return res.status(403).json({ error: 'No tenant' });
        }

        query += ' ORDER BY id ASC';

        console.log('📊 Tarife Query:', { query, params, parsedDojoId, isAllDojos });

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

// PATCH /api/tarife/:id/nachfolger - Nachfolger-Tarif setzen (für archivierte Tarife)
router.patch('/:id/nachfolger', async (req, res) => {
    try {
        const { id } = req.params;
        const { nachfolger_tarif_id } = req.body;

        console.log('Setze Nachfolger-Tarif:', { id, nachfolger_tarif_id });

        // Nachfolger auf NULL setzen erlaubt, oder auf gültige Tarif-ID
        const nachfolgerId = nachfolger_tarif_id ? parseInt(nachfolger_tarif_id, 10) : null;

        // Prüfen ob Nachfolger-Tarif existiert (wenn nicht NULL)
        if (nachfolgerId) {
            const [nachfolger] = await queryAsync('SELECT id, ist_archiviert FROM tarife WHERE id = ?', [nachfolgerId]);
            if (!nachfolger) {
                return res.status(400).json({ error: 'Nachfolger-Tarif nicht gefunden' });
            }
            if (nachfolger.ist_archiviert) {
                return res.status(400).json({ error: 'Nachfolger-Tarif darf nicht archiviert sein' });
            }
        }

        await queryAsync(`
            UPDATE tarife
            SET nachfolger_tarif_id = ?
            WHERE id = ?
        `, [nachfolgerId, id]);

        res.json({
            success: true,
            message: nachfolgerId ? 'Nachfolger-Tarif gesetzt' : 'Nachfolger-Tarif entfernt'
        });
    } catch (err) {
        console.error('Fehler beim Setzen des Nachfolger-Tarifs:', err);
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
        const rawDojoId = req.tenant?.dojo_id || req.dojo_id || req.query.dojo_id || req.user?.dojo_id;

        // Prüfen ob "alle Dojos" ausgewählt wurde
        const isAllDojos = rawDojoId === 'all' || rawDojoId === null || rawDojoId === undefined;
        const parsedDojoId = isAllDojos ? null : parseInt(rawDojoId, 10);

        // User mit dojo_id=null gilt als Super-Admin (kann alle Dojos sehen)
        const isSuperAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin' || req.user?.dojo_id === null;

        if (!isAllDojos && !parsedDojoId && !isSuperAdmin) {
            return res.status(403).json({ error: 'No tenant' });
        }

        let query = `
            SELECT id AS rabatt_id, dojo_id, name, beschreibung, rabatt_prozent,
                   rabatt_typ, rabatt_betrag_cents,
                   gueltig_von, gueltig_bis, max_nutzungen, genutzt, aktiv, erstellt_am,
                   ist_familien_rabatt, familie_position_min, familie_position_max
            FROM rabatte`;
        let params = [];

        if (!isAllDojos && parsedDojoId && !isNaN(parsedDojoId)) {
            query += ' WHERE dojo_id = ?';
            params.push(parsedDojoId);
        }
        // "Alle Dojos" oder Super-Admin ohne Dojo: alle Rabatte (keine WHERE-Klausel)

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

        const { name, beschreibung, rabatt_prozent, rabatt_typ, rabatt_betrag_cents, gueltig_von, gueltig_bis, max_nutzungen, aktiv, ist_familien_rabatt, familie_position_min, familie_position_max } = req.body;
        const result = await queryAsync(`
            INSERT INTO rabatte (name, beschreibung, rabatt_prozent, rabatt_typ, rabatt_betrag_cents, gueltig_von, gueltig_bis, max_nutzungen, aktiv, dojo_id, ist_familien_rabatt, familie_position_min, familie_position_max)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            beschreibung,
            rabatt_typ === 'prozent' ? rabatt_prozent : null,
            rabatt_typ || 'prozent',
            rabatt_typ === 'betrag' ? rabatt_betrag_cents : null,
            parseDate(gueltig_von),
            parseDate(gueltig_bis),  // null = unbegrenzt gültig
            max_nutzungen || null,
            aktiv,
            parsedDojoId,
            ist_familien_rabatt || false,
            ist_familien_rabatt ? (familie_position_min || null) : null,
            ist_familien_rabatt ? (familie_position_max || null) : null
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
                genutzt: 0,
                ist_familien_rabatt: ist_familien_rabatt || false,
                familie_position_min: ist_familien_rabatt ? familie_position_min : null,
                familie_position_max: ist_familien_rabatt ? familie_position_max : null
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
        const { name, beschreibung, rabatt_prozent, rabatt_typ, rabatt_betrag_cents, gueltig_von, gueltig_bis, max_nutzungen, aktiv, ist_familien_rabatt, familie_position_min, familie_position_max } = req.body;
        await queryAsync(`
            UPDATE rabatte
            SET name = ?, beschreibung = ?, rabatt_prozent = ?, rabatt_typ = ?, rabatt_betrag_cents = ?,
                gueltig_von = ?, gueltig_bis = ?, max_nutzungen = ?, aktiv = ?,
                ist_familien_rabatt = ?, familie_position_min = ?, familie_position_max = ?
            WHERE id = ? AND dojo_id = ?
        `, [
            name,
            beschreibung,
            rabatt_typ === 'prozent' ? rabatt_prozent : null,
            rabatt_typ || 'prozent',
            rabatt_typ === 'betrag' ? rabatt_betrag_cents : null,
            parseDate(gueltig_von),
            parseDate(gueltig_bis),
            max_nutzungen || null,
            aktiv,
            ist_familien_rabatt || false,
            ist_familien_rabatt ? (familie_position_min || null) : null,
            ist_familien_rabatt ? (familie_position_max || null) : null,
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