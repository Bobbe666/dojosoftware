/**
 * Lastschrift-Zeitpläne API
 * CRUD-Operationen für automatische Lastschriftläufe
 */
const express = require("express");
const db = require("../db");
const logger = require("../utils/logger");
const PaymentProviderFactory = require("../services/PaymentProviderFactory");
const { getSecureDojoId, isSuperAdmin } = require("../middleware/tenantSecurity");
const router = express.Router();

// Helper: Promise-basierte DB-Query
function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

/**
 * GET /api/lastschrift-zeitplaene
 * Liste aller Zeitpläne für ein Dojo (oder alle Dojos)
 */
router.get("/", async (req, res) => {
    try {
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
        const userIsSuperAdmin = isSuperAdmin(req);

        let query, params;

        if (userIsSuperAdmin && dojoId === null) {
            // Super-Admin: Lade alle Zeitpläne
            query = `
                SELECT
                    z.*,
                    d.dojoname,
                    (SELECT COUNT(*) FROM lastschrift_ausfuehrungen a WHERE a.zeitplan_id = z.zeitplan_id) as anzahl_ausfuehrungen
                FROM lastschrift_zeitplaene z
                LEFT JOIN dojo d ON z.dojo_id = d.id
                ORDER BY z.dojo_id ASC, z.ausfuehrungstag ASC, z.ausfuehrungszeit ASC
            `;
            params = [];
        } else if (dojoId) {
            query = `
                SELECT
                    z.*,
                    d.dojoname,
                    (SELECT COUNT(*) FROM lastschrift_ausfuehrungen a WHERE a.zeitplan_id = z.zeitplan_id) as anzahl_ausfuehrungen
                FROM lastschrift_zeitplaene z
                LEFT JOIN dojo d ON z.dojo_id = d.id
                WHERE z.dojo_id = ?
                ORDER BY z.ausfuehrungstag ASC, z.ausfuehrungszeit ASC
            `;
            params = [dojoId];
        } else {
            return res.status(400).json({ error: "Dojo ID erforderlich" });
        }

        const zeitplaene = await queryAsync(query, params);

        res.json({
            success: true,
            count: zeitplaene.length,
            zeitplaene
        });

    } catch (error) {
        logger.error("Fehler beim Laden der Zeitpläne:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * GET /api/lastschrift-zeitplaene/:id
 * Einzelnen Zeitplan abrufen
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);

        const query = `
            SELECT * FROM lastschrift_zeitplaene
            WHERE zeitplan_id = ? AND dojo_id = ?
        `;

        const zeitplaene = await queryAsync(query, [id, dojoId]);

        if (zeitplaene.length === 0) {
            return res.status(404).json({ error: "Zeitplan nicht gefunden" });
        }

        res.json({
            success: true,
            zeitplan: zeitplaene[0]
        });

    } catch (error) {
        logger.error("Fehler beim Laden des Zeitplans:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * POST /api/lastschrift-zeitplaene
 * Neuen Zeitplan erstellen
 */
router.post("/", async (req, res) => {
    try {
        let dojoId = getSecureDojoId(req);

        // Super-Admin darf dojo_id aus Body setzen; normale Admins nicht
        if (!dojoId && isSuperAdmin(req)) {
            dojoId = req.body.dojo_id || null;
        }

        if (!dojoId && !isSuperAdmin(req)) {
            return res.status(400).json({ error: "Dojo ID erforderlich" });
        }

        // "all" wird als NULL gespeichert (für alle Dojos — nur Super-Admin)
        if (dojoId === "all") {
            dojoId = null;
        }

        const {
            name,
            beschreibung,
            ausfuehrungstag,
            ausfuehrungszeit,
            typ,
            nur_faellige_bis_tag,
            zahlungszyklus_filter,
            aktiv
        } = req.body;

        // Validierung
        if (!name || name.trim() === "") {
            return res.status(400).json({ error: "Name ist erforderlich" });
        }

        if (!ausfuehrungstag || ausfuehrungstag < 1 || ausfuehrungstag > 28) {
            return res.status(400).json({ error: "Ausführungstag muss zwischen 1 und 28 liegen" });
        }

        const insertQuery = `
            INSERT INTO lastschrift_zeitplaene (
                dojo_id, name, beschreibung, ausfuehrungstag, ausfuehrungszeit,
                typ, nur_faellige_bis_tag, zahlungszyklus_filter, aktiv
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await queryAsync(insertQuery, [
            dojoId,
            name.trim(),
            beschreibung || null,
            ausfuehrungstag,
            ausfuehrungszeit || "06:00:00",
            typ || "beitraege",
            nur_faellige_bis_tag || null,
            zahlungszyklus_filter ? JSON.stringify(zahlungszyklus_filter) : null,
            aktiv !== false
        ]);

        logger.info(`Zeitplan erstellt: ${name} für Dojo ${dojoId === 0 ? 'ALLE' : dojoId}`);

        res.json({
            success: true,
            zeitplan_id: result.insertId,
            message: "Zeitplan erfolgreich erstellt"
        });

    } catch (error) {
        logger.error("Fehler beim Erstellen des Zeitplans:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * PUT /api/lastschrift-zeitplaene/:id
 * Zeitplan aktualisieren
 */
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        let dojoId = getSecureDojoId(req);
        if (!dojoId && isSuperAdmin(req)) dojoId = req.body.dojo_id || null;

        // "all" wird als NULL gespeichert
        if (dojoId === "all") {
            dojoId = null;
        }

        const {
            name,
            beschreibung,
            ausfuehrungstag,
            ausfuehrungszeit,
            typ,
            nur_faellige_bis_tag,
            zahlungszyklus_filter,
            aktiv
        } = req.body;

        // Prüfe ob Zeitplan existiert
        const existing = await queryAsync(
            "SELECT zeitplan_id, dojo_id FROM lastschrift_zeitplaene WHERE zeitplan_id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: "Zeitplan nicht gefunden" });
        }

        const updateQuery = `
            UPDATE lastschrift_zeitplaene SET
                name = COALESCE(?, name),
                beschreibung = ?,
                ausfuehrungstag = COALESCE(?, ausfuehrungstag),
                ausfuehrungszeit = COALESCE(?, ausfuehrungszeit),
                typ = COALESCE(?, typ),
                nur_faellige_bis_tag = ?,
                zahlungszyklus_filter = ?,
                aktiv = COALESCE(?, aktiv),
                aktualisiert_am = NOW()
            WHERE zeitplan_id = ?
        `;

        await queryAsync(updateQuery, [
            name,
            beschreibung,
            ausfuehrungstag,
            ausfuehrungszeit,
            typ,
            nur_faellige_bis_tag,
            zahlungszyklus_filter ? JSON.stringify(zahlungszyklus_filter) : null,
            aktiv,
            id
        ]);

        logger.info(`Zeitplan aktualisiert: ID ${id}`);

        res.json({
            success: true,
            message: "Zeitplan erfolgreich aktualisiert"
        });

    } catch (error) {
        logger.error("Fehler beim Aktualisieren des Zeitplans:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * DELETE /api/lastschrift-zeitplaene/:id
 * Zeitplan löschen
 */
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await queryAsync(
            "DELETE FROM lastschrift_zeitplaene WHERE zeitplan_id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Zeitplan nicht gefunden" });
        }

        logger.info(`Zeitplan gelöscht: ID ${id}`);

        res.json({
            success: true,
            message: "Zeitplan erfolgreich gelöscht"
        });

    } catch (error) {
        logger.error("Fehler beim Löschen des Zeitplans:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * POST /api/lastschrift-zeitplaene/:id/execute
 * Zeitplan manuell ausführen
 */
router.post("/:id/execute", async (req, res) => {
    try {
        const { id } = req.params;
        let dojoId = getSecureDojoId(req);
        if (!dojoId && isSuperAdmin(req)) dojoId = req.body.dojo_id || null;

        // Lade Zeitplan
        const zeitplaene = await queryAsync(
            "SELECT * FROM lastschrift_zeitplaene WHERE zeitplan_id = ? AND dojo_id = ?",
            [id, dojoId]
        );

        if (zeitplaene.length === 0) {
            return res.status(404).json({ error: "Zeitplan nicht gefunden" });
        }

        const zeitplan = zeitplaene[0];

        // Führe den Lastschriftlauf aus
        const result = await executeScheduledPaymentRun(zeitplan, dojoId);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        logger.error("Fehler bei manueller Ausführung:", error);
        res.status(500).json({ error: "Ausführungsfehler", details: error.message });
    }
});

/**
 * GET /api/lastschrift-zeitplaene/:id/ausfuehrungen
 * Ausführungs-Historie eines Zeitplans
 */
router.get("/:id/ausfuehrungen", async (req, res) => {
    try {
        const { id } = req.params;
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);
        const limit = parseInt(req.query.limit) || 20;

        const query = `
            SELECT *
            FROM lastschrift_ausfuehrungen
            WHERE zeitplan_id = ? AND dojo_id = ?
            ORDER BY gestartet_am DESC
            LIMIT ?
        `;

        const ausfuehrungen = await queryAsync(query, [id, dojoId, limit]);

        res.json({
            success: true,
            count: ausfuehrungen.length,
            ausfuehrungen
        });

    } catch (error) {
        logger.error("Fehler beim Laden der Ausführungen:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * GET /api/lastschrift-ausfuehrungen/:id
 * Details einer einzelnen Ausführung
 */
router.get("/ausfuehrung/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
        const dojoId = getSecureDojoId(req);

        const query = `
            SELECT a.*, z.name as zeitplan_name
            FROM lastschrift_ausfuehrungen a
            LEFT JOIN lastschrift_zeitplaene z ON a.zeitplan_id = z.zeitplan_id
            WHERE a.ausfuehrung_id = ? AND a.dojo_id = ?
        `;

        const ausfuehrungen = await queryAsync(query, [id, dojoId]);

        if (ausfuehrungen.length === 0) {
            return res.status(404).json({ error: "Ausführung nicht gefunden" });
        }

        res.json({
            success: true,
            ausfuehrung: ausfuehrungen[0]
        });

    } catch (error) {
        logger.error("Fehler beim Laden der Ausführung:", error);
        res.status(500).json({ error: "Datenbankfehler", details: error.message });
    }
});

/**
 * Führt einen geplanten Lastschriftlauf aus
 * @param {Object} zeitplan - Der Zeitplan-Eintrag
 * @param {number} dojoId - Die Dojo-ID
 * @returns {Object} Ergebnis der Ausführung
 */
async function executeScheduledPaymentRun(zeitplan, dojoId) {
    const now = new Date();
    const monat = now.getMonth() + 1;
    const jahr = now.getFullYear();

    logger.info(`📅 Starte automatischen Lastschriftlauf: ${zeitplan.name} (Typ: ${zeitplan.typ})`);

    // Erstelle Ausführungs-Eintrag
    const insertAusfuehrung = await queryAsync(
        `INSERT INTO lastschrift_ausfuehrungen (zeitplan_id, dojo_id, status)
         VALUES (?, ?, 'gestartet')`,
        [zeitplan.zeitplan_id, dojoId]
    );
    const ausfuehrungId = insertAusfuehrung.insertId;

    try {
        // Bestimme Enddatum für Beiträge basierend auf Filter
        let monatEnde;
        if (zeitplan.nur_faellige_bis_tag) {
            monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-${String(zeitplan.nur_faellige_bis_tag).padStart(2, '0')}`;
        } else {
            monatEnde = `${jahr}-${String(monat).padStart(2, '0')}-31`;
        }

        // Lade Mitglieder mit offenen Beiträgen basierend auf Typ
        // Unterstützt sowohl einzelne Typen als auch komma-getrennte Listen
        let mitglieder = [];
        const typen = zeitplan.typ ? zeitplan.typ.split(',') : ['beitraege'];
        const includeBeitraege = typen.includes('beitraege') || typen.includes('alle');
        const includeRechnungen = typen.includes('rechnungen') || typen.includes('alle');
        const includeVerkaeufe = typen.includes('verkaeufe') || typen.includes('alle');

        if (includeBeitraege) {
            const beitraegeMitglieder = await ladeBeitraegeMitglieder(dojoId, monatEnde, zeitplan.zahlungszyklus_filter);
            mitglieder = mitglieder.concat(beitraegeMitglieder);
        }

        if (includeRechnungen) {
            const rechnungenMitglieder = await ladeRechnungenMitglieder(dojoId);
            // Kombiniere mit existierenden Mitgliedern (addiere Beträge)
            for (const rm of rechnungenMitglieder) {
                const existing = mitglieder.find(m => m.mitglied_id === rm.mitglied_id);
                if (existing) {
                    existing.betrag += rm.betrag;
                    existing.rechnungen = rm.rechnungen;
                } else {
                    mitglieder.push(rm);
                }
            }
        }

        if (includeVerkaeufe) {
            const verkaeufeMitglieder = await ladeVerkaeufeMitglieder(dojoId);
            for (const vm of verkaeufeMitglieder) {
                const existing = mitglieder.find(m => m.mitglied_id === vm.mitglied_id);
                if (existing) {
                    existing.betrag += vm.betrag;
                    existing.verkaeufe = vm.verkaeufe;
                } else {
                    mitglieder.push(vm);
                }
            }
        }

        if (mitglieder.length === 0) {
            // Nichts zu tun
            await updateAusfuehrung(ausfuehrungId, 'erfolg', 0, 0, 0, 0, null, null);
            await updateZeitplanLetzte(zeitplan.zeitplan_id, 'erfolg', 0, 0);

            logger.info(`✅ Lastschriftlauf ${zeitplan.name}: Keine offenen Posten`);

            return {
                ausfuehrung_id: ausfuehrungId,
                status: 'erfolg',
                message: 'Keine offenen Posten gefunden',
                anzahl_verarbeitet: 0
            };
        }

        // Hole Stripe Provider
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (!provider || !provider.processLastschriftBatch) {
            throw new Error('Stripe nicht konfiguriert');
        }

        // Führe Batch aus
        const result = await provider.processLastschriftBatch(mitglieder, monat, jahr);

        // Markiere erfolgreiche Beiträge als bezahlt
        if (result.succeeded > 0 || result.processing > 0) {
            for (const trans of result.transactions) {
                if (trans.status === 'succeeded' || trans.status === 'processing') {
                    const mitgliedData = mitglieder.find(m => m.mitglied_id === trans.mitglied_id);
                    if (mitgliedData) {
                        if (mitgliedData.beitraege) {
                            for (const beitrag of mitgliedData.beitraege) {
                                await queryAsync(
                                    'UPDATE beitraege SET bezahlt = 1, zahlungsart = ? WHERE beitrag_id = ?',
                                    ['Stripe SEPA (Auto)', beitrag.beitrag_id]
                                );
                            }
                        }
                        if (mitgliedData.rechnungen) {
                            for (const rechnung of mitgliedData.rechnungen) {
                                await queryAsync(
                                    "UPDATE rechnungen SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = 'lastschrift' WHERE rechnung_id = ?",
                                    [rechnung.rechnung_id]
                                );
                            }
                        }
                        if (mitgliedData.verkaeufe) {
                            for (const verkauf of mitgliedData.verkaeufe) {
                                await queryAsync(
                                    "UPDATE verkaeufe SET zahlungsstatus = 'bezahlt' WHERE verkauf_id = ?",
                                    [verkauf.verkauf_id]
                                );
                            }
                        }
                    }
                }
            }
        }

        // Bestimme Status
        const status = result.failed === 0 ? 'erfolg' : (result.succeeded > 0 ? 'teilweise' : 'fehler');
        const gesamtbetrag = mitglieder.reduce((sum, m) => sum + m.betrag, 0);

        // Aktualisiere Ausführung
        await updateAusfuehrung(
            ausfuehrungId,
            status,
            result.total,
            result.succeeded + result.processing,
            result.failed,
            gesamtbetrag,
            result.batch_id,
            result.failed > 0 ? { failed_transactions: result.transactions.filter(t => t.status === 'failed') } : null
        );

        // Aktualisiere Zeitplan
        await updateZeitplanLetzte(zeitplan.zeitplan_id, status, result.succeeded + result.processing, gesamtbetrag);

        logger.info(`✅ Lastschriftlauf ${zeitplan.name} abgeschlossen: ${result.succeeded}/${result.total} erfolgreich`);

        return {
            ausfuehrung_id: ausfuehrungId,
            batch_id: result.batch_id,
            status,
            anzahl_verarbeitet: result.total,
            anzahl_erfolgreich: result.succeeded + result.processing,
            anzahl_fehlgeschlagen: result.failed,
            gesamtbetrag
        };

    } catch (error) {
        logger.error(`❌ Fehler bei Lastschriftlauf ${zeitplan.name}:`, error);

        await updateAusfuehrung(ausfuehrungId, 'fehler', 0, 0, 0, 0, null, { error: error.message });
        await updateZeitplanLetzte(zeitplan.zeitplan_id, 'fehler', 0, 0);

        throw error;
    }
}

/**
 * Lädt Mitglieder mit offenen Beiträgen
 */
async function ladeBeitraegeMitglieder(dojoId, monatEnde, zahlungszyklusFilter) {
    let query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.stripe_customer_id,
            sm.stripe_payment_method_id,
            SUM(b.betrag) as betrag,
            GROUP_CONCAT(b.beitrag_id) as beitrag_ids
        FROM mitglieder m
        INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        INNER JOIN beitraege b ON m.mitglied_id = b.mitglied_id AND b.bezahlt = 0 AND b.zahlungsdatum <= ?
        WHERE m.dojo_id = ?
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND m.stripe_customer_id IS NOT NULL
          AND sm.stripe_payment_method_id IS NOT NULL
    `;
    const params = [monatEnde, dojoId];

    // Optional: Filter nach Zahlungszyklus
    if (zahlungszyklusFilter && Array.isArray(JSON.parse(zahlungszyklusFilter))) {
        const zyklen = JSON.parse(zahlungszyklusFilter);
        if (zyklen.length > 0) {
            const placeholders = zyklen.map(() => '?').join(',');
            query += ` AND EXISTS (
                SELECT 1 FROM vertraege v
                WHERE v.mitglied_id = m.mitglied_id
                AND v.status = 'aktiv'
                AND v.billing_cycle IN (${placeholders})
            )`;
            params.push(...zyklen);
        }
    }

    query += ` GROUP BY m.mitglied_id, m.vorname, m.nachname, m.stripe_customer_id, sm.stripe_payment_method_id`;

    const results = await queryAsync(query, params);

    return results.map(r => ({
        mitglied_id: r.mitglied_id,
        name: `${r.vorname} ${r.nachname}`,
        betrag: parseFloat(r.betrag),
        beitraege: r.beitrag_ids.split(',').map(id => ({ beitrag_id: parseInt(id) }))
    }));
}

/**
 * Lädt Mitglieder mit offenen Rechnungen
 */
async function ladeRechnungenMitglieder(dojoId) {
    const query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            SUM(r.betrag) as betrag,
            GROUP_CONCAT(r.rechnung_id) as rechnung_ids
        FROM mitglieder m
        INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        INNER JOIN rechnungen r ON m.mitglied_id = r.mitglied_id
            AND r.status IN ('offen', 'teilweise_bezahlt', 'ueberfaellig')
            AND r.archiviert = 0
        WHERE m.dojo_id = ?
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND m.stripe_customer_id IS NOT NULL
          AND sm.stripe_payment_method_id IS NOT NULL
        GROUP BY m.mitglied_id, m.vorname, m.nachname
    `;

    const results = await queryAsync(query, [dojoId]);

    return results.map(r => ({
        mitglied_id: r.mitglied_id,
        name: `${r.vorname} ${r.nachname}`,
        betrag: parseFloat(r.betrag),
        rechnungen: r.rechnung_ids.split(',').map(id => ({ rechnung_id: parseInt(id) }))
    }));
}

/**
 * Lädt Mitglieder mit offenen Verkäufen
 */
async function ladeVerkaeufeMitglieder(dojoId) {
    const query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            SUM(v.brutto_gesamt_cent / 100) as betrag,
            GROUP_CONCAT(v.verkauf_id) as verkauf_ids
        FROM mitglieder m
        INNER JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
        INNER JOIN verkaeufe v ON m.mitglied_id = v.mitglied_id
            AND v.zahlungsart = 'lastschrift'
            AND v.zahlungsstatus = 'offen'
        WHERE m.dojo_id = ?
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND m.stripe_customer_id IS NOT NULL
          AND sm.stripe_payment_method_id IS NOT NULL
        GROUP BY m.mitglied_id, m.vorname, m.nachname
    `;

    const results = await queryAsync(query, [dojoId]);

    return results.map(r => ({
        mitglied_id: r.mitglied_id,
        name: `${r.vorname} ${r.nachname}`,
        betrag: parseFloat(r.betrag),
        verkaeufe: r.verkauf_ids.split(',').map(id => ({ verkauf_id: parseInt(id) }))
    }));
}

/**
 * Aktualisiert den Ausführungs-Eintrag
 */
async function updateAusfuehrung(id, status, verarbeitet, erfolgreich, fehlgeschlagen, betrag, batchId, fehlerDetails) {
    await queryAsync(
        `UPDATE lastschrift_ausfuehrungen SET
            status = ?,
            anzahl_verarbeitet = ?,
            anzahl_erfolgreich = ?,
            anzahl_fehlgeschlagen = ?,
            gesamtbetrag = ?,
            stripe_batch_id = ?,
            fehler_details = ?,
            beendet_am = NOW()
        WHERE ausfuehrung_id = ?`,
        [status, verarbeitet, erfolgreich, fehlgeschlagen, betrag, batchId, fehlerDetails ? JSON.stringify(fehlerDetails) : null, id]
    );
}

/**
 * Aktualisiert die letzte Ausführung im Zeitplan
 */
async function updateZeitplanLetzte(zeitplanId, status, anzahl, betrag) {
    await queryAsync(
        `UPDATE lastschrift_zeitplaene SET
            letzte_ausfuehrung = NOW(),
            letzte_ausfuehrung_status = ?,
            letzte_ausfuehrung_anzahl = ?,
            letzte_ausfuehrung_betrag = ?
        WHERE zeitplan_id = ?`,
        [status, anzahl, betrag, zeitplanId]
    );
}

// Exportiere auch die Ausführungsfunktion für den Cron-Job
router.executeScheduledPaymentRun = executeScheduledPaymentRun;

module.exports = router;
