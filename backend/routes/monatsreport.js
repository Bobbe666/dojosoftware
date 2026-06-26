// ============================================================================
// monatsreport.js  →  /api/monatsreport
// Monatsbericht für den AKTUELLEN Monat: Umsätze (Verkäufe + bezahlte
// Rechnungen), neue Verträge, Kündigungen (mit Eingangsdatum) und Pausen.
// Wird vom Frontend (Beitraege.jsx → loadMonatsreport) konsumiert.
// Auto-Loader mountet ohne Auth → Router schützt sich selbst.
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const logger = require('../utils/logger');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const pool = db.promise();
    const dojoId = getSecureDojoId(req); // null = Super-Admin ohne Dojo-Filter

    const now = new Date();
    const jahr = now.getFullYear();
    const monat = now.getMonth() + 1;
    const pad = (n) => String(n).padStart(2, '0');
    const monatStart = `${jahr}-${pad(monat)}-01`;
    const nextMonat = monat === 12 ? 1 : monat + 1;
    const nextJahr = monat === 12 ? jahr + 1 : jahr;
    const monatEnde = `${nextJahr}-${pad(nextMonat)}-01`; // exklusiv

    // Dojo-Filter-Baustein + Parameter-Helfer
    const dF = dojoId ? ' AND {a}.dojo_id = ?' : '';
    const p = (base) => (dojoId ? [...base, dojoId] : base);

    // --- Umsätze: Verkäufe (brutto, Cent) ---
    const [verk] = await pool.query(
      `SELECT COALESCE(SUM(v.brutto_gesamt_cent), 0) / 100 AS brutto, COUNT(*) AS anzahl
         FROM verkaeufe v
        WHERE v.verkauf_datum >= ? AND v.verkauf_datum < ?${dF.replace('{a}', 'v')}`,
      p([monatStart, monatEnde])
    );

    // --- Umsätze: bezahlte Rechnungen (Beiträge/Belege) ---
    const [rech] = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(r.brutto_betrag, r.betrag)), 0) AS gesamt, COUNT(*) AS anzahl
         FROM rechnungen r
        WHERE r.status = 'bezahlt'
          AND COALESCE(r.bezahlt_am, r.rechnungsdatum, r.datum) >= ?
          AND COALESCE(r.bezahlt_am, r.rechnungsdatum, r.datum) < ?${dF.replace('{a}', 'r')}`,
      p([monatStart, monatEnde])
    );

    const verkaufBrutto = parseFloat(verk[0].brutto) || 0;
    const beitraegeGesamt = parseFloat(rech[0].gesamt) || 0;

    // --- Neue Verträge (Vertragsbeginn im Monat) ---
    const [neueVertraege] = await pool.query(
      `SELECT v.id AS vertrag_id, CONCAT(m.vorname, ' ', m.nachname) AS mitglied_name,
              v.vertragsnummer, v.vertragsbeginn,
              COALESCE(v.monatsbeitrag, v.monatlicher_beitrag) AS monatsbeitrag
         FROM vertraege v JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
        WHERE v.vertragsbeginn >= ? AND v.vertragsbeginn < ?${dF.replace('{a}', 'v')}
        ORDER BY v.vertragsbeginn DESC`,
      p([monatStart, monatEnde])
    );

    // --- Kündigungen (Eingang im Monat) ---
    const [kuendigungen] = await pool.query(
      `SELECT v.id AS vertrag_id, CONCAT(m.vorname, ' ', m.nachname) AS mitglied_name,
              v.vertragsnummer, v.kuendigungsdatum, v.kuendigung_eingegangen, v.kuendigungsgrund
         FROM vertraege v JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
        WHERE v.kuendigung_eingegangen >= ? AND v.kuendigung_eingegangen < ?${dF.replace('{a}', 'v')}
        ORDER BY v.kuendigung_eingegangen DESC`,
      p([monatStart, monatEnde])
    );

    // --- Pausen (Ruhepause-Beginn im Monat) ---
    const [pausen] = await pool.query(
      `SELECT v.id AS vertrag_id, CONCAT(m.vorname, ' ', m.nachname) AS mitglied_name,
              v.vertragsnummer, v.ruhepause_von, v.ruhepause_bis, v.ruhepause_dauer_monate
         FROM vertraege v JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
        WHERE v.ruhepause_von >= ? AND v.ruhepause_von < ?${dF.replace('{a}', 'v')}
        ORDER BY v.ruhepause_von DESC`,
      p([monatStart, monatEnde])
    );

    res.json({
      success: true,
      jahr,
      monat,
      umsaetze: {
        gesamt: verkaufBrutto + beitraegeGesamt,
        verkauf: { brutto: verkaufBrutto, anzahl: verk[0].anzahl },
        beitraege: { gesamt: beitraegeGesamt, anzahl: rech[0].anzahl },
      },
      neueVertraege: { anzahl: neueVertraege.length, liste: neueVertraege },
      kuendigungen: { anzahl: kuendigungen.length, liste: kuendigungen },
      pausen: { anzahl: pausen.length, liste: pausen },
    });
  } catch (err) {
    logger.error('Monatsreport-Fehler', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
