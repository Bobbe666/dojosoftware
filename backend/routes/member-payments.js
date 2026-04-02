// ============================================================================
// MEMBER PAYMENTS — Mitglieder-Zahlungsübersicht und Rechnungen
// ============================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const pool = db.promise();

// GET /api/member-payments/rechnungen
// Mitglied ruft eigene offene Rechnungen ab (nur eigene, nie fremde)
router.get('/rechnungen', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        const [rechnungen] = await pool.query(
            `SELECT r.rechnung_id, r.rechnungsnummer, r.datum, r.faelligkeitsdatum,
                    r.betrag, r.gesamtsumme, r.status, r.art, r.beschreibung,
                    r.zahlungsart, r.bezahlt_am
             FROM rechnungen r
             WHERE r.mitglied_id = ?
               AND r.dojo_id = ?
               AND r.archiviert = 0
             ORDER BY
               CASE r.status
                 WHEN 'ueberfaellig' THEN 1
                 WHEN 'offen' THEN 2
                 WHEN 'teilweise_bezahlt' THEN 3
                 ELSE 4
               END,
               r.faelligkeitsdatum ASC
             LIMIT 100`,
            [mitgliedId, dojoId]
        );

        // Offene Beiträge ebenfalls einbeziehen
        const [beitraege] = await pool.query(
            `SELECT b.beitrag_id, b.betrag, b.zahlungsdatum, b.zahlungsart,
                    b.bezahlt, b.beschreibung
             FROM beitraege b
             WHERE b.mitglied_id = ?
               AND b.bezahlt = 0
               AND b.zahlungsdatum <= CURDATE() + INTERVAL 7 DAY
             ORDER BY b.zahlungsdatum ASC
             LIMIT 50`,
            [mitgliedId]
        );

        res.json({
            rechnungen,
            beitraege,
            offene_gesamt: rechnungen
                .filter(r => ['offen', 'teilweise_bezahlt', 'ueberfaellig'].includes(r.status))
                .reduce((s, r) => s + parseFloat(r.gesamtsumme || r.betrag || 0), 0)
        });

    } catch (error) {
        logger.error('Member Rechnungen Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Laden der Rechnungen' });
    }
});

// GET /api/member-payments/history
// Mitglied ruft Zahlungshistorie ab
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        const [payments] = await pool.query(
            `SELECT spi.stripe_payment_intent_id, spi.amount, spi.currency, spi.status,
                    spi.description, spi.created_at,
                    r.rechnungsnummer, r.art as rechnung_art
             FROM stripe_payment_intents spi
             LEFT JOIN rechnungen r ON spi.metadata LIKE CONCAT('%"rechnung_id":"', r.rechnung_id, '"%')
             WHERE spi.mitglied_id = ?
               AND spi.dojo_id = ?
               AND spi.status IN ('succeeded', 'processing')
             ORDER BY spi.created_at DESC
             LIMIT 50`,
            [mitgliedId, dojoId]
        );

        // Auch bezahlte Beiträge
        const [bezahlteBeitraege] = await pool.query(
            `SELECT b.beitrag_id, b.betrag, b.zahlungsdatum, b.zahlungsart, b.beschreibung
             FROM beitraege b
             WHERE b.mitglied_id = ?
               AND b.bezahlt = 1
               AND b.zahlungsart IN ('Stripe SEPA', 'Stripe SEPA (Auto)', 'kreditkarte', 'Kreditkarte')
             ORDER BY b.zahlungsdatum DESC
             LIMIT 30`,
            [mitgliedId]
        );

        res.json({ payments, bezahlte_beitraege: bezahlteBeitraege });

    } catch (error) {
        logger.error('Member History Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Laden der Zahlungshistorie' });
    }
});

// POST /api/member-payments/rechnung/:id/bezahlt
// Wird vom Webhook aufgerufen ODER nach erfolgreichem payment_intent.succeeded
// Sicherheitsprüfung: Mitglied darf nur eigene Rechnungen bestätigen
router.post('/rechnung/:id/bezahlt', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        const dojoId = req.user?.dojo_id;
        const rechnungId = parseInt(req.params.id);
        const { payment_intent_id } = req.body;

        if (!mitgliedId) {
            return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        }

        if (!payment_intent_id) {
            return res.status(400).json({ error: 'payment_intent_id erforderlich' });
        }

        // Eigentümerschaft prüfen
        const [[rechnung]] = await pool.query(
            'SELECT rechnung_id, status FROM rechnungen WHERE rechnung_id = ? AND mitglied_id = ? AND dojo_id = ?',
            [rechnungId, mitgliedId, dojoId]
        );

        if (!rechnung) {
            return res.status(404).json({ error: 'Rechnung nicht gefunden' });
        }

        if (rechnung.status === 'bezahlt') {
            return res.json({ success: true, message: 'Bereits als bezahlt markiert' });
        }

        // PI-Status bei Stripe verifizieren (Server-seitig, nicht Frontend)
        const PaymentProviderFactory = require('../services/PaymentProviderFactory');
        const provider = await PaymentProviderFactory.getProvider(dojoId);

        if (provider.stripe) {
            const pi = await provider.stripe.paymentIntents.retrieve(payment_intent_id);

            if (pi.status !== 'succeeded' && pi.status !== 'processing') {
                return res.status(400).json({ error: `Zahlung noch nicht abgeschlossen (Status: ${pi.status})` });
            }

            // PI-Metadaten prüfen: Gehört diese Zahlung wirklich zu dieser Rechnung?
            if (pi.metadata?.rechnung_id && parseInt(pi.metadata.rechnung_id) !== rechnungId) {
                return res.status(403).json({ error: 'Zahlung gehört nicht zu dieser Rechnung' });
            }
        }

        // Rechnung als bezahlt markieren
        await pool.query(
            `UPDATE rechnungen SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = 'kreditkarte'
             WHERE rechnung_id = ? AND mitglied_id = ? AND dojo_id = ?`,
            [rechnungId, mitgliedId, dojoId]
        );

        logger.info(`✅ Rechnung ${rechnungId} bezahlt — Mitglied ${mitgliedId} — PI: ${payment_intent_id}`);

        res.json({ success: true, message: 'Rechnung erfolgreich als bezahlt markiert' });

    } catch (error) {
        logger.error('Rechnung bezahlt Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Rechnung' });
    }
});

module.exports = router;
