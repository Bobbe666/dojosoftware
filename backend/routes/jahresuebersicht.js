/**
 * Jahresübersicht Routes
 * =======================
 * Einnahmen vs. Ausgaben nach Monat für die EÜR-Jahresübersicht
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

/**
 * GET /api/jahresuebersicht
 * Monatliche Einnahmen und Ausgaben für ein Jahr
 * Query params: jahr (default: aktuelles Jahr)
 */
router.get('/', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const jahr = parseInt(req.query.jahr) || new Date().getFullYear();

  if (!secureDojoId) {
    return res.status(400).json({ error: 'Keine Berechtigung - dojo_id nicht verfügbar' });
  }

  try {
    // 1. Monatliche Ausgaben aus kassenbuch
    const [ausgabenMonatlich] = await pool.query(`
      SELECT
        MONTH(geschaeft_datum) AS monat,
        SUM(betrag_cent) / 100 AS summe,
        COUNT(*) AS anzahl
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
      GROUP BY MONTH(geschaeft_datum)
      ORDER BY monat
    `, [secureDojoId, jahr]);

    // 2. Monatliche Einnahmen aus kassenbuch (Bareinnahmen / Kontoauszug-Importe)
    const [einnahmenKassenbuch] = await pool.query(`
      SELECT
        MONTH(geschaeft_datum) AS monat,
        SUM(betrag_cent) / 100 AS summe,
        COUNT(*) AS anzahl
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Einnahme'
        AND YEAR(geschaeft_datum) = ?
      GROUP BY MONTH(geschaeft_datum)
      ORDER BY monat
    `, [secureDojoId, jahr]);

    // 3. Monatliche Beitragseinnahmen aus transaktionen (Mitgliedsbeiträge)
    const [beitragseinnahmen] = await pool.query(`
      SELECT
        MONTH(t.erstellt_am) AS monat,
        SUM(t.betrag) AS summe,
        COUNT(*) AS anzahl
      FROM transaktionen t
      JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
      WHERE m.dojo_id = ?
        AND t.status = 'bezahlt'
        AND YEAR(t.erstellt_am) = ?
      GROUP BY MONTH(t.erstellt_am)
      ORDER BY monat
    `, [secureDojoId, jahr]);

    // 4. Vorjahr-Gesamtdaten (Ausgaben + Einnahmen aus kassenbuch)
    const [vorjahrAusgaben] = await pool.query(`
      SELECT SUM(betrag_cent) / 100 AS gesamt
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
    `, [secureDojoId, jahr - 1]);

    const [vorjahrEinnahmen] = await pool.query(`
      SELECT SUM(betrag_cent) / 100 AS gesamt
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Einnahme'
        AND YEAR(geschaeft_datum) = ?
    `, [secureDojoId, jahr - 1]);

    const [vorjahrBeitraege] = await pool.query(`
      SELECT SUM(t.betrag) AS gesamt
      FROM transaktionen t
      JOIN mitglieder m ON t.mitglied_id = m.mitglied_id
      WHERE m.dojo_id = ?
        AND t.status = 'bezahlt'
        AND YEAR(t.erstellt_am) = ?
    `, [secureDojoId, jahr - 1]);

    // 5. Ausgaben nach Kategorie (Jahrestotal)
    const [ausgabenKategorien] = await pool.query(`
      SELECT
        COALESCE(kategorie, 'sonstiges') AS kategorie,
        SUM(betrag_cent) / 100 AS summe,
        COUNT(*) AS anzahl
      FROM kassenbuch
      WHERE dojo_id = ?
        AND bewegungsart = 'Ausgabe'
        AND YEAR(geschaeft_datum) = ?
      GROUP BY kategorie
      ORDER BY summe DESC
    `, [secureDojoId, jahr]);

    // ── Monatsdaten aufbauen (12 Monate, auch leere) ──────────────────────
    const monate = [];
    for (let m = 1; m <= 12; m++) {
      const ausgabe = ausgabenMonatlich.find(r => r.monat === m);
      const einnahmeKasse = einnahmenKassenbuch.find(r => r.monat === m);
      const beitrag = beitragseinnahmen.find(r => r.monat === m);

      const einnahmenGesamt = (parseFloat(einnahmeKasse?.summe || 0) + parseFloat(beitrag?.summe || 0));
      const ausgabenGesamt = parseFloat(ausgabe?.summe || 0);

      monate.push({
        monat: m,
        einnahmen: Math.round(einnahmenGesamt * 100) / 100,
        ausgaben: Math.round(ausgabenGesamt * 100) / 100,
        gewinn: Math.round((einnahmenGesamt - ausgabenGesamt) * 100) / 100,
        einnahmenKassenbuch: parseFloat(einnahmeKasse?.summe || 0),
        beitragseinnahmen: parseFloat(beitrag?.summe || 0)
      });
    }

    // ── Jahrestotale ──────────────────────────────────────────────────────
    const jahresEinnahmen = monate.reduce((s, m) => s + m.einnahmen, 0);
    const jahresAusgaben = monate.reduce((s, m) => s + m.ausgaben, 0);
    const jahresGewinn = jahresEinnahmen - jahresAusgaben;

    const vj_einnahmen = parseFloat(vorjahrEinnahmen[0]?.gesamt || 0) + parseFloat(vorjahrBeitraege[0]?.gesamt || 0);
    const vj_ausgaben = parseFloat(vorjahrAusgaben[0]?.gesamt || 0);
    const vj_gewinn = vj_einnahmen - vj_ausgaben;

    res.json({
      success: true,
      jahr,
      monate,
      jahrestotal: {
        einnahmen: Math.round(jahresEinnahmen * 100) / 100,
        ausgaben: Math.round(jahresAusgaben * 100) / 100,
        gewinn: Math.round(jahresGewinn * 100) / 100
      },
      vorjahr: {
        einnahmen: Math.round(vj_einnahmen * 100) / 100,
        ausgaben: Math.round(vj_ausgaben * 100) / 100,
        gewinn: Math.round(vj_gewinn * 100) / 100
      },
      ausgabenNachKategorie: ausgabenKategorien
    });

  } catch (err) {
    logger.error('Jahresübersicht Fehler:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Laden der Jahresübersicht' });
  }
});

module.exports = router;
