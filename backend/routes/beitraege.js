const express = require("express");
const logger = require('../utils/logger');
const db = require("../db"); // MySQL-Datenbankanbindung importieren
const auditLog = require("../services/auditLogService");
const { generateInitialBeitraege, generateMissingBeitraege } = require('./vertraege/shared');
const { generateMonthlyBeitraege } = require('../cron-jobs');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

// API: Beiträge für ein Mitglied abrufen
router.get("/", (req, res) => {
    const { mitglied_id } = req.query;
    const secureDojoId = getSecureDojoId(req);

    if (!mitglied_id) {
        return res.status(400).json({ error: "Mitglied-ID ist erforderlich" });
    }

    let whereConditions = ['b.mitglied_id = ?'];
    let queryParams = [mitglied_id];

    if (secureDojoId) {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(secureDojoId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            b.beitrag_id,
            b.mitglied_id,
            b.betrag,
            b.zahlungsart,
            b.zahlungsdatum,
            b.bezahlt,
            b.dojo_id,
            b.magicline_description,
            b.magicline_transaction_id,
            CONCAT(m.vorname, ' ', m.nachname) as mitglied_name
        FROM beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        ${whereClause}
        ORDER BY b.zahlungsdatum DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            logger.error('Fehler beim Abrufen der Beiträge:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        res.json(results);
    });
});

// API: Neuen Beitrag erstellen
router.post("/", (req, res) => {
    const { mitglied_id, betrag, zahlungsart, zahlungsdatum, bezahlt } = req.body;
    const secureDojoId = getSecureDojoId(req);

    if (!mitglied_id || !betrag) {
        return res.status(400).json({ error: "Mitglied-ID und Betrag sind erforderlich" });
    }
    if (!secureDojoId) {
        return res.status(400).json({ error: "Dojo-ID erforderlich" });
    }

    const query = `
        INSERT INTO beitraege (mitglied_id, betrag, zahlungsart, zahlungsdatum, bezahlt, dojo_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
        mitglied_id,
        betrag,
        zahlungsart || 'ueberweisung',
        zahlungsdatum || new Date().toISOString().split('T')[0],
        bezahlt ? 1 : 0,
        secureDojoId
    ];

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Erstellen des Beitrags:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        // Audit-Log
        auditLog.log({
            req,
            aktion: auditLog.AKTION.BEITRAG_ERSTELLT,
            kategorie: auditLog.KATEGORIE.FINANZEN,
            entityType: 'beitraege',
            entityId: result.insertId,
            neueWerte: { mitglied_id, betrag, zahlungsart, bezahlt },
            beschreibung: `Beitrag erstellt: ${betrag}€ für Mitglied #${mitglied_id}`
        });

        res.json({
            success: true,
            beitrag_id: result.insertId,
            message: 'Beitrag erfolgreich erstellt'
        });
    });
});

// API: Beitrag aktualisieren
router.put("/:beitrag_id", (req, res) => {
    const { beitrag_id } = req.params;
    const { betrag, zahlungsart, zahlungsdatum, bezahlt } = req.body;
    const secureDojoId = getSecureDojoId(req);

    const query = secureDojoId
        ? `UPDATE beitraege SET betrag = ?, zahlungsart = ?, zahlungsdatum = ?, bezahlt = ? WHERE beitrag_id = ? AND dojo_id = ?`
        : `UPDATE beitraege SET betrag = ?, zahlungsart = ?, zahlungsdatum = ?, bezahlt = ? WHERE beitrag_id = ?`;

    const params = secureDojoId
        ? [betrag, zahlungsart, zahlungsdatum, bezahlt ? 1 : 0, beitrag_id, secureDojoId]
        : [betrag, zahlungsart, zahlungsdatum, bezahlt ? 1 : 0, beitrag_id];

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Aktualisieren des Beitrags:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        // Audit-Log
        auditLog.log({
            req,
            aktion: auditLog.AKTION.BEITRAG_AKTUALISIERT,
            kategorie: auditLog.KATEGORIE.FINANZEN,
            entityType: 'beitraege',
            entityId: parseInt(beitrag_id),
            neueWerte: { betrag, zahlungsart, zahlungsdatum, bezahlt },
            beschreibung: `Beitrag #${beitrag_id} aktualisiert`
        });

        res.json({
            success: true,
            message: 'Beitrag erfolgreich aktualisiert'
        });
    });
});

// API: Beitrag löschen
router.delete("/:beitrag_id", (req, res) => {
    const { beitrag_id } = req.params;
    const secureDojoId = getSecureDojoId(req);

    const query = secureDojoId
        ? `DELETE FROM beitraege WHERE beitrag_id = ? AND dojo_id = ?`
        : `DELETE FROM beitraege WHERE beitrag_id = ?`;
    const params = secureDojoId ? [beitrag_id, secureDojoId] : [beitrag_id];

    db.query(query, params, (err, result) => {
        if (err) {
            logger.error('Fehler beim Löschen des Beitrags:', err);
            return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        // Audit-Log
        auditLog.log({
            req,
            aktion: auditLog.AKTION.BEITRAG_GELOESCHT,
            kategorie: auditLog.KATEGORIE.FINANZEN,
            entityType: 'beitraege',
            entityId: parseInt(beitrag_id),
            beschreibung: `Beitrag #${beitrag_id} gelöscht`
        });

        res.json({
            success: true,
            message: 'Beitrag erfolgreich gelöscht'
        });
    });
});

/**
 * API: Fehlende Beiträge für ALLE aktiven Verträge nachgenerieren
 * POST /api/beitraege/regenerate-all
 *
 * Generiert fehlende Monatsbeiträge für alle aktiven Verträge.
 * Bereits existierende Beiträge werden NICHT überschrieben.
 */
router.post("/regenerate-all", async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const secureDojoId = getSecureDojoId(req);

        // Hole alle aktiven Verträge
        let whereClause = 'WHERE v.status = ?';
        const params = ['aktiv'];

        if (secureDojoId) {
            whereClause += ' AND v.dojo_id = ?';
            params.push(secureDojoId);
        }

        const vertraege = await queryAsync(`
            SELECT
                v.id as vertrag_id,
                v.mitglied_id,
                v.dojo_id,
                v.vertragsbeginn,
                v.vertragsende,
                v.mindestlaufzeit_monate,
                COALESCE(v.monatsbeitrag, t.price_cents / 100) as monatsbeitrag,
                m.vorname,
                m.nachname
            FROM vertraege v
            JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
            LEFT JOIN tarife t ON v.tarif_id = t.id
            ${whereClause}
            ORDER BY v.id
        `, params);

        const results = {
            total_vertraege: vertraege.length,
            processed: 0,
            beitraege_eingefuegt: 0,
            beitraege_uebersprungen: 0,
            errors: [],
            details: []
        };

        for (const vertrag of vertraege) {
            try {
                if (!vertrag.monatsbeitrag || vertrag.monatsbeitrag <= 0) {
                    results.details.push({
                        vertrag_id: vertrag.vertrag_id,
                        mitglied: `${vertrag.vorname} ${vertrag.nachname}`,
                        status: 'skipped',
                        reason: 'Kein Monatsbeitrag definiert'
                    });
                    continue;
                }

                const beitraegeResult = await generateInitialBeitraege(
                    vertrag.mitglied_id,
                    vertrag.dojo_id,
                    vertrag.vertragsbeginn,
                    vertrag.monatsbeitrag,
                    0, // Keine Aufnahmegebühr bei Nachgenerierung
                    vertrag.vertragsende,
                    vertrag.mindestlaufzeit_monate || 12
                );

                results.processed++;
                results.beitraege_eingefuegt += beitraegeResult.insertedIds?.length || 0;
                results.beitraege_uebersprungen += beitraegeResult.skippedCount || 0;

                if (beitraegeResult.insertedIds?.length > 0) {
                    results.details.push({
                        vertrag_id: vertrag.vertrag_id,
                        mitglied: `${vertrag.vorname} ${vertrag.nachname}`,
                        status: 'success',
                        eingefuegt: beitraegeResult.insertedIds.length,
                        uebersprungen: beitraegeResult.skippedCount
                    });
                }
            } catch (error) {
                results.errors.push({
                    vertrag_id: vertrag.vertrag_id,
                    mitglied: `${vertrag.vorname} ${vertrag.nachname}`,
                    error: error.message
                });
            }
        }

        // Rolling-Window: fehlende SEPA-Beiträge bis Ende nächsten Monats sicherstellen
        // (deckt Verträge ab deren Mindestlaufzeit abgelaufen ist)
        try {
            const cronResult = await generateMonthlyBeitraege();
            results.beitraege_eingefuegt += cronResult.generated || 0;
            logger.info(`Rolling-Window-Nachgenerierung: ${cronResult.generated} neue Beiträge`);
        } catch (e) {
            logger.error('Rolling-Window-Generierung fehlgeschlagen:', e.message);
        }

        // Audit-Log
        auditLog.log({
            req,
            aktion: 'BEITRAEGE_REGENERIERT',
            kategorie: auditLog.KATEGORIE.FINANZEN,
            entityType: 'beitraege',
            beschreibung: `Beiträge nachgeneriert: ${results.beitraege_eingefuegt} neue, ${results.beitraege_uebersprungen} übersprungen`
        });

        logger.info('Beiträge-Regenerierung abgeschlossen:', results);

        res.json({
            success: true,
            ...results
        });
    } catch (error) {
        logger.error('Fehler bei Beiträge-Regenerierung:', error);
        res.status(500).json({
            error: 'Fehler bei der Beiträge-Regenerierung',
            details: error.message
        });
    }
});

/**
 * API: Fehlende Beiträge für einen einzelnen Vertrag nachgenerieren
 * POST /api/beitraege/regenerate/:vertrag_id
 */
router.post("/regenerate/:vertrag_id", async (req, res) => {
    try {
        const { vertrag_id } = req.params;

        const result = await generateMissingBeitraege(parseInt(vertrag_id));

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Audit-Log
        auditLog.log({
            req,
            aktion: 'BEITRAEGE_REGENERIERT',
            kategorie: auditLog.KATEGORIE.FINANZEN,
            entityType: 'beitraege',
            beschreibung: `Beiträge für Vertrag #${vertrag_id} nachgeneriert: ${result.insertedIds?.length || 0} neue`
        });

        res.json({
            success: true,
            vertrag_id: parseInt(vertrag_id),
            beitraege_eingefuegt: result.insertedIds?.length || 0,
            beitraege_uebersprungen: result.skippedCount || 0
        });
    } catch (error) {
        logger.error('Fehler beim Regenerieren der Beiträge:', error);
        res.status(500).json({
            error: 'Fehler beim Regenerieren der Beiträge',
            details: error.message
        });
    }
});

module.exports = router;