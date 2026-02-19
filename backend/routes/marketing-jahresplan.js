/**
 * =============================================================================
 * MARKETING-JAHRESPLAN API
 * =============================================================================
 * CRUD-Operationen für Marketing-Aktionen im Jahresplan
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

/**
 * GET /marketing-jahresplan
 * Alle Marketing-Aktionen für ein Jahr abrufen
 */
router.get('/', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { jahr } = req.query;

        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo-ID erforderlich' });
        }

        const year = parseInt(jahr) || new Date().getFullYear();

        const aktionen = await queryAsync(`
            SELECT
                id,
                dojo_id,
                titel,
                beschreibung,
                typ,
                start_datum,
                end_datum,
                status,
                zielgruppe,
                budget,
                notizen,
                erstellt_am,
                aktualisiert_am
            FROM marketing_jahresplan
            WHERE dojo_id = ?
              AND YEAR(start_datum) = ?
            ORDER BY start_datum ASC
        `, [dojoId, year]);

        res.json(aktionen);

    } catch (error) {
        logger.error('Fehler beim Laden der Marketing-Aktionen:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * GET /marketing-jahresplan/:id
 * Einzelne Marketing-Aktion abrufen
 */
router.get('/:id', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;

        const [aktion] = await queryAsync(`
            SELECT * FROM marketing_jahresplan
            WHERE id = ? AND dojo_id = ?
        `, [id, dojoId]);

        if (!aktion) {
            return res.status(404).json({ error: 'Aktion nicht gefunden' });
        }

        res.json(aktion);

    } catch (error) {
        logger.error('Fehler beim Laden der Aktion:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * POST /marketing-jahresplan
 * Neue Marketing-Aktion erstellen
 */
router.post('/', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const {
            titel,
            beschreibung,
            typ,
            start_datum,
            end_datum,
            status,
            zielgruppe,
            budget,
            notizen
        } = req.body;

        if (!dojoId) {
            return res.status(400).json({ error: 'Dojo-ID erforderlich' });
        }

        if (!titel || !start_datum) {
            return res.status(400).json({ error: 'Titel und Startdatum sind erforderlich' });
        }

        const result = await queryAsync(`
            INSERT INTO marketing_jahresplan
            (dojo_id, titel, beschreibung, typ, start_datum, end_datum, status, zielgruppe, budget, notizen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            dojoId,
            titel,
            beschreibung || null,
            typ || 'sonstiges',
            start_datum,
            end_datum || null,
            status || 'geplant',
            zielgruppe || null,
            budget || null,
            notizen || null
        ]);

        logger.info(`Marketing-Aktion erstellt: ${titel} (ID: ${result.insertId})`);

        res.status(201).json({
            success: true,
            id: result.insertId,
            message: 'Marketing-Aktion erfolgreich erstellt'
        });

    } catch (error) {
        logger.error('Fehler beim Erstellen der Aktion:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PUT /marketing-jahresplan/:id
 * Marketing-Aktion aktualisieren
 */
router.put('/:id', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;
        const {
            titel,
            beschreibung,
            typ,
            start_datum,
            end_datum,
            status,
            zielgruppe,
            budget,
            notizen
        } = req.body;

        // Prüfen ob Aktion existiert und zum Dojo gehört
        const [existing] = await queryAsync(`
            SELECT id FROM marketing_jahresplan WHERE id = ? AND dojo_id = ?
        `, [id, dojoId]);

        if (!existing) {
            return res.status(404).json({ error: 'Aktion nicht gefunden' });
        }

        await queryAsync(`
            UPDATE marketing_jahresplan
            SET
                titel = ?,
                beschreibung = ?,
                typ = ?,
                start_datum = ?,
                end_datum = ?,
                status = ?,
                zielgruppe = ?,
                budget = ?,
                notizen = ?,
                aktualisiert_am = NOW()
            WHERE id = ? AND dojo_id = ?
        `, [
            titel,
            beschreibung || null,
            typ || 'sonstiges',
            start_datum,
            end_datum || null,
            status || 'geplant',
            zielgruppe || null,
            budget || null,
            notizen || null,
            id,
            dojoId
        ]);

        logger.info(`Marketing-Aktion aktualisiert: ID ${id}`);

        res.json({
            success: true,
            message: 'Marketing-Aktion erfolgreich aktualisiert'
        });

    } catch (error) {
        logger.error('Fehler beim Aktualisieren der Aktion:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * PATCH /marketing-jahresplan/:id/status
 * Status einer Marketing-Aktion aktualisieren
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;
        const { status } = req.body;

        const validStatus = ['geplant', 'in_vorbereitung', 'aktiv', 'abgeschlossen', 'abgebrochen'];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ error: 'Ungültiger Status' });
        }

        const result = await queryAsync(`
            UPDATE marketing_jahresplan
            SET status = ?, aktualisiert_am = NOW()
            WHERE id = ? AND dojo_id = ?
        `, [status, id, dojoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Aktion nicht gefunden' });
        }

        res.json({
            success: true,
            message: 'Status aktualisiert'
        });

    } catch (error) {
        logger.error('Fehler beim Status-Update:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

/**
 * DELETE /marketing-jahresplan/:id
 * Marketing-Aktion löschen
 */
router.delete('/:id', async (req, res) => {
    try {
        const dojoId = getSecureDojoId(req);
        const { id } = req.params;

        const result = await queryAsync(`
            DELETE FROM marketing_jahresplan
            WHERE id = ? AND dojo_id = ?
        `, [id, dojoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Aktion nicht gefunden' });
        }

        logger.info(`Marketing-Aktion gelöscht: ID ${id}`);

        res.json({
            success: true,
            message: 'Marketing-Aktion erfolgreich gelöscht'
        });

    } catch (error) {
        logger.error('Fehler beim Löschen der Aktion:', error);
        res.status(500).json({ error: 'Datenbankfehler', details: error.message });
    }
});

module.exports = router;
