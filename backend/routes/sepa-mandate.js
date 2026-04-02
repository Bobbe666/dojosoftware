const express = require("express");
const logger = require('../utils/logger');
const crypto = require("crypto");
const db = require("../db");
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const router = express.Router();

const VALID_STATUS = ['aktiv', 'widerrufen', 'abgelaufen'];
const MASSEN_LIMIT = 500;

// API: ALLE SEPA-Mandate abrufen (für Verwaltung) — dojo-gefiltert
router.get("/", authenticateToken, (req, res) => {
    const secureDojoId = getSecureDojoId(req);
    const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];

    const query = `
        SELECT
            sm.mandat_id,
            sm.mitglied_id,
            sm.iban,
            sm.bic,
            sm.bankname as bank_name,
            sm.kontoinhaber,
            sm.mandatsreferenz,
            sm.glaeubiger_id,
            sm.status,
            sm.erstellungsdatum,
            sm.letzte_nutzung,
            sm.archiviert,
            sm.mandat_typ,
            sm.provider,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
        FROM sepa_mandate sm
        LEFT JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE (sm.archiviert = 0 OR sm.archiviert IS NULL)
          ${dojoFilter}
        ORDER BY sm.erstellungsdatum DESC
    `;

    db.query(query, params, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen aller SEPA-Mandate:', err);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
        res.json({ success: true, data: results });
    });
});

// API: Mitglieder ohne aktives SEPA-Mandat abrufen
router.get('/ohne-mandat', authenticateToken, (req, res) => {
    const secureDojoId = getSecureDojoId(req);
    let where = `WHERE m.aktiv = 1
    AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
    AND m.mitglied_id NOT IN (
      SELECT sm.mitglied_id FROM sepa_mandate sm
      WHERE (sm.archiviert = 0 OR sm.archiviert IS NULL)
        AND sm.status = 'aktiv'
    )`;
    const params = [];
    if (secureDojoId) { where += ' AND m.dojo_id = ?'; params.push(secureDojoId); }
    db.query(
        `SELECT m.mitglied_id, m.vorname, m.nachname, m.iban, m.bic, m.kontoinhaber
     FROM mitglieder m ${where} ORDER BY m.nachname, m.vorname`,
        params,
        (err, rows) => {
            if (err) {
                logger.error('Fehler bei ohne-mandat:', err);
                return res.status(500).json({ error: 'Datenbankfehler' });
            }
            res.json({ success: true, data: rows });
        }
    );
});

// API: SEPA-Mandate massenhaft erstellen (Admin-Import ohne Unterschrift)
router.post('/massen-erstellung', authenticateToken, async (req, res) => {
    const role = req.user?.rolle;
    if (role !== 'admin' && role !== 'super_admin')
        return res.status(403).json({ error: 'Nur für Admins' });

    const secureDojoId = getSecureDojoId(req);
    if (!secureDojoId)
        return res.status(400).json({ error: 'Dojo-ID erforderlich' });

    const { mandate } = req.body;
    if (!Array.isArray(mandate) || mandate.length === 0)
        return res.status(400).json({ error: 'Keine Mandate angegeben' });
    if (mandate.length > MASSEN_LIMIT)
        return res.status(400).json({ error: `Maximal ${MASSEN_LIMIT} Mandate pro Aufruf` });

    const pool = db.promise();
    let erstellt = 0, fehler = 0;
    const details = [];

    for (const m of mandate) {
        if (!m.mitglied_id || !m.iban || !m.kontoinhaber) { fehler++; continue; }
        try {
            // Sicherheitscheck: Mitglied muss zum Dojo gehören
            const [rows] = await pool.query(
                'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
                [m.mitglied_id, secureDojoId]
            );
            if (!rows.length) {
                fehler++;
                details.push({ mitglied_id: m.mitglied_id, fehler: 'Nicht gefunden' });
                continue;
            }
            // Duplikat-Check: kein zweites aktives Mandat anlegen
            const [existing] = await pool.query(
                `SELECT mandat_id FROM sepa_mandate
                 WHERE mitglied_id = ? AND status = 'aktiv'
                   AND (archiviert = 0 OR archiviert IS NULL)`,
                [m.mitglied_id]
            );
            if (existing.length) {
                fehler++;
                details.push({ mitglied_id: m.mitglied_id, fehler: 'Bereits aktives Mandat vorhanden' });
                continue;
            }

            const ref = `DOJO${secureDojoId}-${m.mitglied_id}-${Date.now()}`;
            await pool.query(
                `INSERT INTO sepa_mandate (mitglied_id, iban, bic, bankname, kontoinhaber,
         mandatsreferenz, status, erstellungsdatum)
         VALUES (?, ?, ?, ?, ?, ?, 'aktiv', NOW())`,
                [m.mitglied_id, m.iban, m.bic || '', m.bankname || null, m.kontoinhaber, ref]
            );
            await pool.query(
                `UPDATE mitglieder SET zahlungsmethode = 'Lastschrift'
         WHERE mitglied_id = ? AND dojo_id = ?`,
                [m.mitglied_id, secureDojoId]
            );
            erstellt++;
        } catch (e) {
            logger.error('Massen-Mandat Fehler:', { error: e, mitglied_id: m.mitglied_id });
            fehler++;
            details.push({ mitglied_id: m.mitglied_id, fehler: 'Fehler beim Anlegen' });
        }
    }
    res.json({ success: true, erstellt, fehler, details });
});

// API: SEPA-Mandate für ein Mitglied abrufen
router.get("/:mitglied_id/sepa-mandate", authenticateToken, (req, res) => {
    const { mitglied_id } = req.params;
    const secureDojoId = getSecureDojoId(req);
    const dojoFilter = secureDojoId ? 'AND m.dojo_id = ?' : '';
    const params = secureDojoId ? [mitglied_id, secureDojoId] : [mitglied_id];

    const query = `
        SELECT
            sm.mandat_id,
            sm.mitglied_id,
            sm.iban,
            sm.bic,
            sm.bankname as bank_name,
            sm.kontoinhaber,
            sm.mandatsreferenz,
            sm.status,
            sm.erstellungsdatum as erstellt_am,
            sm.letzte_nutzung as letzte_abrechnung,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE sm.mitglied_id = ? ${dojoFilter}
        ORDER BY sm.erstellungsdatum DESC
    `;

    db.query(query, params, (err, results) => {
        if (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
            logger.error('Fehler beim Abrufen der SEPA-Mandate:', err);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
        res.json(results);
    });
});

// API: Neues SEPA-Mandat erstellen
router.post("/:mitglied_id/sepa-mandate", authenticateToken, async (req, res) => {
    const { mitglied_id } = req.params;
    const secureDojoId = getSecureDojoId(req);
    if (!secureDojoId)
        return res.status(400).json({ error: 'Dojo-ID erforderlich' });

    // Ownership-Check: Mitglied muss zum Dojo gehören
    const pool = db.promise();
    const [ownerRows] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
        [mitglied_id, secureDojoId]
    ).catch(() => [[]]);
    if (!ownerRows.length)
        return res.status(403).json({ error: 'Zugriff verweigert' });

    const {
        iban, bic, bank_name, kontoinhaber, mandatsreferenz,
        unterschrift_digital, unterschrift_datum, unterschrift_ip
    } = req.body;

    if (!iban || !kontoinhaber)
        return res.status(400).json({ error: "IBAN und Kontoinhaber sind erforderlich" });

    let unterschriftHash = null;
    if (unterschrift_digital) {
        unterschriftHash = crypto.createHash('sha256')
            .update(unterschrift_digital)
            .digest('hex');
    }

    const finalMandatsreferenz = mandatsreferenz || `DOJO-${mitglied_id}-${Date.now()}`;

    const insertQuery = `
        INSERT INTO sepa_mandate (
            mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz,
            unterschrift_digital, unterschrift_datum, unterschrift_ip, unterschrift_hash,
            status, erstellungsdatum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', NOW())
    `;

    const params = [
        mitglied_id, iban, bic || '', bank_name || null, kontoinhaber,
        finalMandatsreferenz, unterschrift_digital || null,
        unterschrift_datum ? new Date(unterschrift_datum) : null,
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || null,
        unterschriftHash
    ];

    db.query(insertQuery, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Erstellen des SEPA-Mandats:', { error: err });
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
        logger.debug(`SEPA-Mandat erstellt: ID=${result.insertId}, Mitglied=${mitglied_id}, ` +
            `Ref=${finalMandatsreferenz}, Signiert=${!!unterschrift_digital}`);
        res.json({
            success: true,
            mandat_id: result.insertId,
            mandatsreferenz: finalMandatsreferenz,
            message: 'SEPA-Mandat erfolgreich erstellt' +
                (unterschrift_digital ? ' (mit digitaler Unterschrift)' : '')
        });
    });
});

// API: SEPA-Mandat aktualisieren
router.put("/:mitglied_id/sepa-mandate/:mandat_id", authenticateToken, (req, res) => {
    const { mitglied_id, mandat_id } = req.params;
    const secureDojoId = getSecureDojoId(req);
    const { iban, bic, bank_name, kontoinhaber, status } = req.body;

    if (status && !VALID_STATUS.includes(status))
        return res.status(400).json({ error: 'Ungültiger Status' });

    const dojoJoin = secureDojoId
        ? 'JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id AND m.dojo_id = ?'
        : '';
    const params = secureDojoId
        ? [iban, bic || '', bank_name, kontoinhaber, status, secureDojoId, mandat_id, mitglied_id]
        : [iban, bic || '', bank_name, kontoinhaber, status, mandat_id, mitglied_id];

    const query = `
        UPDATE sepa_mandate sm
        ${dojoJoin}
        SET sm.iban = ?, sm.bic = ?, sm.bankname = ?, sm.kontoinhaber = ?, sm.status = ?
        WHERE sm.mandat_id = ? AND sm.mitglied_id = ?
    `;

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Aktualisieren des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'SEPA-Mandat nicht gefunden' });
        res.json({ success: true, message: 'SEPA-Mandat erfolgreich aktualisiert' });
    });
});

// API: SEPA-Mandat löschen (mit mitglied_id)
router.delete("/:mitglied_id/sepa-mandate/:mandat_id", authenticateToken, (req, res) => {
    const { mitglied_id, mandat_id } = req.params;
    const secureDojoId = getSecureDojoId(req);

    const query = secureDojoId
        ? `DELETE sm FROM sepa_mandate sm
           JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id AND m.dojo_id = ?
           WHERE sm.mandat_id = ? AND sm.mitglied_id = ?`
        : `DELETE FROM sepa_mandate WHERE mandat_id = ? AND mitglied_id = ?`;
    const params = secureDojoId
        ? [secureDojoId, mandat_id, mitglied_id]
        : [mandat_id, mitglied_id];

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'SEPA-Mandat nicht gefunden' });
        res.json({ success: true, message: 'SEPA-Mandat erfolgreich gelöscht' });
    });
});

// API: SEPA-Mandat löschen (direkter Zugriff über mandat_id für Verwaltung)
router.delete("/:mandat_id", authenticateToken, (req, res) => {
    const { mandat_id } = req.params;
    const secureDojoId = getSecureDojoId(req);

    const query = secureDojoId
        ? `DELETE sm FROM sepa_mandate sm
           JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id AND m.dojo_id = ?
           WHERE sm.mandat_id = ?`
        : `DELETE FROM sepa_mandate WHERE mandat_id = ?`;
    const params = secureDojoId ? [secureDojoId, mandat_id] : [mandat_id];

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen des SEPA-Mandats:', err);
            return res.status(500).json({ error: 'Datenbankfehler' });
        }
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'SEPA-Mandat nicht gefunden' });
        res.json({ success: true, message: 'SEPA-Mandat erfolgreich gelöscht' });
    });
});

module.exports = router;
