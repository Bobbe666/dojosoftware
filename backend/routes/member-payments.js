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

// GET /api/member-payments/rechnung/:id
// Mitglied ruft eine einzelne eigene Rechnung ab (Eigentümerschaft wird geprüft)
router.get('/rechnung/:id', authenticateToken, async (req, res) => {
    try {
        const mitgliedId = req.user?.mitglied_id;
        if (!mitgliedId) return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });

        const rechnungId = parseInt(req.params.id);
        if (!rechnungId) return res.status(400).json({ error: 'Ungültige Rechnungs-ID' });

        const [rows] = await pool.query(
            `SELECT r.rechnung_id, r.rechnungsnummer, r.rechnungsdatum, r.faelligkeitsdatum,
                    r.gesamtsumme, r.betrag, r.status, r.art, r.beschreibung,
                    r.positionen
             FROM rechnungen r
             JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
             WHERE r.rechnung_id = ?
               AND r.mitglied_id = ?
               AND r.archiviert = 0`,
            [rechnungId, mitgliedId]
        );

        if (!rows.length) return res.status(404).json({ error: 'Rechnung nicht gefunden' });

        const r = rows[0];
        res.json({
            success: true,
            rechnung: {
                ...r,
                gesamtbetrag: parseFloat(r.gesamtsumme || r.betrag || 0),
                positionen: r.positionen ? (typeof r.positionen === 'string' ? JSON.parse(r.positionen) : r.positionen) : []
            }
        });
    } catch (error) {
        logger.error('Member Rechnung Fehler:', { error: error.message });
        res.status(500).json({ error: 'Fehler beim Laden der Rechnung' });
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

// GET /api/member-payments/naechste-abbuchung
// Zeigt dem Mitglied, woraus sich die nächste Abbuchung zusammensetzt
// (eigene offene Posten) + die letzten Lastschriften. Nur eigene Daten.
router.get('/naechste-abbuchung', authenticateToken, async (req, res) => {
    try {
        const mid = req.user?.mitglied_id;
        if (!mid) return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
        const n = new Date();
        const bis = new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [beitraege] = await pool.query(
            `SELECT art, betrag, zahlungsdatum, beschreibung FROM beitraege
             WHERE mitglied_id = ? AND bezahlt = 0 AND zahlungsdatum <= ? ORDER BY zahlungsdatum`, [mid, bis]);
        const [rechnungen] = await pool.query(
            `SELECT rechnungsnummer, COALESCE(gesamtsumme, betrag) AS betrag, COALESCE(rechnungsdatum, datum) AS datum
             FROM rechnungen WHERE mitglied_id = ? AND archiviert = 0 AND status IN ('offen','teilweise_bezahlt','ueberfaellig')
             ORDER BY COALESCE(rechnungsdatum, datum)`, [mid]);
        const [verkaeufe] = await pool.query(
            `SELECT bon_nummer, brutto_gesamt_cent / 100 AS betrag, verkauf_datum FROM verkaeufe
             WHERE mitglied_id = ? AND zahlungsart = 'lastschrift' AND zahlungsstatus = 'offen' AND (storniert = 0 OR storniert IS NULL)
             ORDER BY verkauf_datum`, [mid]);
        const [lastschriften] = await pool.query(
            `SELECT t.betrag, t.status, t.created_at, b.monat, b.jahr
             FROM stripe_lastschrift_transaktion t JOIN stripe_lastschrift_batch b ON t.batch_id = b.batch_id
             WHERE t.mitglied_id = ? ORDER BY t.created_at DESC LIMIT 12`, [mid]);

        const num = (v) => parseFloat(v) || 0;
        const ART = { mitgliedsbeitrag: 'Mitgliedsbeitrag', pruefungsgebuehr: 'Prüfungsgebühr', artikel: 'Artikel', aufnahmegebuehr: 'Aufnahmegebühr' };
        const posten = [
            ...beitraege.map(b => ({ label: ART[b.art] || b.art || 'Beitrag', betrag: num(b.betrag), datum: b.zahlungsdatum, info: b.beschreibung || null })),
            ...rechnungen.map(r => ({ label: `Rechnung ${r.rechnungsnummer || ''}`.trim(), betrag: num(r.betrag), datum: r.datum, info: null })),
            ...verkaeufe.map(v => ({ label: 'Artikel / Verkauf', betrag: num(v.betrag), datum: v.verkauf_datum, info: null })),
        ];
        const gesamt = posten.reduce((s, p) => s + p.betrag, 0);
        res.json({
            success: true,
            gesamt,
            anzahl: posten.length,
            posten,
            lastschriften: lastschriften.map(l => ({ betrag: num(l.betrag), status: l.status, datum: l.created_at, monat: l.monat, jahr: l.jahr })),
        });
    } catch (err) {
        logger.error('Fehler bei naechste-abbuchung:', { error: err });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
