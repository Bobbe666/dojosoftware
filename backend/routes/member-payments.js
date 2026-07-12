// ============================================================================
// MEMBER PAYMENTS — Mitglieder-Zahlungsübersicht und Rechnungen
// ============================================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const PaymentProviderFactory = require('../services/PaymentProviderFactory');

const pool = db.promise();

// --- IBAN-Helfer (Normalisierung, Mod-97-Prüfung, Maskierung) ---
const normalizeIBAN = (iban) => String(iban || '').replace(/\s+/g, '').toUpperCase();
const isValidIBAN = (iban) => {
  const v = normalizeIBAN(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString());
  let rem = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    rem = parseInt(String(rem) + numeric.slice(i, i + 7), 10) % 97;
  }
  return rem === 1;
};
const maskIBAN = (iban) => {
  const c = normalizeIBAN(iban);
  if (c.length <= 8) return c;
  return `${c.slice(0, 4)} •••• •••• ${c.slice(-4)}`;
};

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
                    r.gesamtsumme, r.betrag, r.status, r.art, r.beschreibung
             FROM rechnungen r
             JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
             WHERE r.rechnung_id = ?
               AND r.mitglied_id = ?
               AND r.archiviert = 0`,
            [rechnungId, mitgliedId]
        );

        if (!rows.length) return res.status(404).json({ error: 'Rechnung nicht gefunden' });

        // Positionen separat laden (Spalte rechnungen.positionen existiert nicht)
        const [positionen] = await pool.query(
            `SELECT position_nr, bezeichnung, artikelnummer, menge, einzelpreis, gesamtpreis, mwst_satz, beschreibung
             FROM rechnungspositionen
             WHERE rechnung_id = ?
             ORDER BY position_nr ASC`,
            [rechnungId]
        );

        const r = rows[0];
        res.json({
            success: true,
            rechnung: {
                ...r,
                gesamtbetrag: parseFloat(r.gesamtsumme || r.betrag || 0),
                positionen: positionen || []
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

// ============================================================================
// SELF-SERVICE BANKVERBINDUNG (SEPA) — Mitglied ändert eigene IBAN
// ============================================================================

// GET /api/member-payments/bankverbindung — aktuelle (maskierte) Bankverbindung
router.get('/bankverbindung', authenticateToken, async (req, res) => {
  try {
    const mitgliedId = req.user?.mitglied_id;
    const dojoId = req.user?.dojo_id;
    if (!mitgliedId) return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });

    const [rows] = await pool.query(
      `SELECT sm.iban, sm.kontoinhaber, sm.status, sm.stripe_payment_method_id
       FROM sepa_mandate sm
       WHERE sm.mitglied_id = ? AND sm.status = 'aktiv' AND (sm.archiviert = 0 OR sm.archiviert IS NULL)
       ORDER BY sm.erstellungsdatum DESC LIMIT 1`,
      [mitgliedId]
    );

    let providerSupportsSepa = false;
    try {
      const provider = await PaymentProviderFactory.getProvider(dojoId);
      providerSupportsSepa = !!(provider && typeof provider.createSepaCustomer === 'function');
    } catch (_) { /* Provider optional */ }

    const mandat = rows[0] || null;
    res.json({
      success: true,
      hat_mandat: !!mandat,
      iban_masked: mandat?.iban ? maskIBAN(mandat.iban) : null,
      kontoinhaber: mandat?.kontoinhaber || null,
      stripe_ready: !!mandat?.stripe_payment_method_id,
      provider_supports_sepa: providerSupportsSepa,
    });
  } catch (err) {
    logger.error('Fehler bei GET /bankverbindung:', { error: err.message });
    res.status(500).json({ error: 'Bankverbindung konnte nicht geladen werden' });
  }
});

// POST /api/member-payments/bankverbindung — Mitglied hinterlegt neue IBAN selbst
router.post('/bankverbindung', authenticateToken, async (req, res) => {
  try {
    const mitgliedId = req.user?.mitglied_id;
    const dojoId = req.user?.dojo_id;
    if (!mitgliedId) return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });

    let { iban, kontoinhaber, mandat_bestaetigt } = req.body || {};

    if (mandat_bestaetigt !== true) {
      return res.status(400).json({ error: 'Bitte bestätigen Sie das SEPA-Lastschriftmandat.' });
    }
    iban = normalizeIBAN(iban);
    if (!isValidIBAN(iban)) {
      return res.status(400).json({ error: 'Die eingegebene IBAN ist ungültig. Bitte prüfen Sie Ihre Eingabe.' });
    }
    kontoinhaber = String(kontoinhaber || '').trim();
    if (kontoinhaber.length < 3) {
      return res.status(400).json({ error: 'Bitte geben Sie den vollständigen Namen des Kontoinhabers an.' });
    }

    // Mitglied laden (dojo-gescoped)
    const [rows] = await pool.query(
      `SELECT mitglied_id, vorname, nachname, email, stripe_customer_id, dojo_id
       FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
      [mitgliedId, dojoId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    const mitglied = rows[0];

    // 1) Zuerst bei Stripe eine neue SEPA-Zahlungsmethode aus der IBAN erzeugen.
    //    Schlägt das fehl (ungültige IBAN o.ä.), wird NICHTS in der DB verändert.
    let stripeInfo = null;
    let providerSupportsSepa = false;
    try {
      const provider = await PaymentProviderFactory.getProvider(dojoId);
      if (provider && typeof provider.createSepaCustomer === 'function') {
        providerSupportsSepa = true;
        stripeInfo = await provider.createSepaCustomer(mitglied, iban, kontoinhaber);
      }
    } catch (e) {
      logger.error('Bankverbindung Self-Service: Stripe-Setup fehlgeschlagen', { error: e.message, mitgliedId });
      return res.status(400).json({
        error: 'Die Bankverbindung konnte nicht hinterlegt werden. Bitte prüfen Sie Ihre IBAN und versuchen Sie es erneut.'
      });
    }

    // 2) SEPA-Mandat aktualisieren (bestehendes aktives) oder neu anlegen.
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || null;
    const ref = `DOJO${dojoId}-${mitgliedId}-${Date.now()}`;
    const [existing] = await pool.query(
      `SELECT mandat_id FROM sepa_mandate
       WHERE mitglied_id = ? AND status = 'aktiv' AND (archiviert = 0 OR archiviert IS NULL)
       ORDER BY erstellungsdatum DESC LIMIT 1`,
      [mitgliedId]
    );

    if (existing.length) {
      // stripe_payment_method_id wurde durch createSepaCustomer bereits gesetzt.
      await pool.query(
        `UPDATE sepa_mandate
         SET iban = ?, kontoinhaber = ?, mandatsreferenz = ?, unterschrift_datum = NOW(), unterschrift_ip = ?, status = 'aktiv'
         WHERE mandat_id = ?`,
        [iban, kontoinhaber, ref, ip, existing[0].mandat_id]
      );
    } else {
      await pool.query(
        `INSERT INTO sepa_mandate
           (mitglied_id, iban, bic, bankname, kontoinhaber, mandatsreferenz,
            stripe_payment_method_id, unterschrift_datum, unterschrift_ip, status, erstellungsdatum)
         VALUES (?, ?, '', NULL, ?, ?, ?, NOW(), ?, 'aktiv', NOW())`,
        [mitgliedId, iban, kontoinhaber, ref, stripeInfo?.stripe_payment_method_id || null, ip]
      );
    }

    // 3) Mitglied auf Lastschrift + IBAN aktualisieren.
    await pool.query(
      `UPDATE mitglieder SET iban = ?, zahlungsmethode = 'Lastschrift' WHERE mitglied_id = ? AND dojo_id = ?`,
      [iban, mitgliedId, dojoId]
    );

    logger.info('✅ Mitglied hat Bankverbindung selbst aktualisiert', { mitgliedId, dojoId, stripe: !!stripeInfo });
    res.json({
      success: true,
      iban_masked: maskIBAN(iban),
      kontoinhaber,
      stripe_ready: providerSupportsSepa ? !!stripeInfo : null,
      message: 'Ihre Bankverbindung wurde erfolgreich aktualisiert. Offene Beiträge werden über die neue Bankverbindung eingezogen.'
    });
  } catch (err) {
    logger.error('Fehler bei POST /bankverbindung:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Bankverbindung konnte nicht gespeichert werden' });
  }
});

module.exports = router;
