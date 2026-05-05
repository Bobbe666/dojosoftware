/**
 * Buchhaltung Kasse — Manuelles Kassenbuch
 * ==========================================
 * Separate Erfassung von Barein- und -ausgaben für die Buchhaltung.
 * NICHT zu verwechseln mit der POS-Kassenbuch-Tabelle (`kassenbuch`).
 * Diese Tabelle (`buchhaltung_kasse`) dient der steuerlichen Buchführung.
 *
 * MwSt-Berechnung: mwst_betrag = brutto - brutto / (1 + mwst_satz/100)
 *                  betrag_netto = brutto - mwst_betrag
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

router.use(authenticateToken);

const pool = db.promise();

// Helper: Sichere dojo_id aus JWT oder Query (Super-Admin)
const getDojoId = (req) => getSecureDojoId(req) || req.query.dojo_id;

// Helper: MwSt aus Brutto-Betrag berechnen
function berechneMwst(brutto, mwst_satz) {
  const b = parseFloat(brutto);
  const s = parseFloat(mwst_satz);
  const mwst_betrag = b - b / (1 + s / 100);
  const betrag_netto = b - mwst_betrag;
  return {
    mwst_betrag: Math.round(mwst_betrag * 100) / 100,
    betrag_netto: Math.round(betrag_netto * 100) / 100
  };
}

// ===================================================================
// POST /init — Tabelle anlegen
// ===================================================================
router.post('/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buchhaltung_kasse (
        kasse_id INT AUTO_INCREMENT PRIMARY KEY,
        dojo_id INT NOT NULL,
        buchungsdatum DATE NOT NULL,
        buchungstext VARCHAR(255) NOT NULL,
        buchungsart ENUM('einnahme','ausgabe') NOT NULL,
        betrag_brutto DECIMAL(10,2) NOT NULL,
        mwst_satz DECIMAL(5,2) DEFAULT 19,
        mwst_betrag DECIMAL(10,2) DEFAULT 0,
        betrag_netto DECIMAL(10,2) DEFAULT 0,
        kategorie VARCHAR(100) DEFAULT 'sonstige_kosten',
        beleg_nr VARCHAR(100),
        notiz TEXT,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dojo_datum (dojo_id, buchungsdatum)
      )
    `);
    res.json({ success: true, message: 'Tabelle buchhaltung_kasse erstellt oder bereits vorhanden' });
  } catch (err) {
    console.error('[buchhaltung-kasse] /init Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Initialisieren' });
  }
});

// ===================================================================
// GET /saldo — Aktueller Kassenstand
// HINWEIS: Muss VOR GET /:id stehen (falls /:id je ergänzt wird)
// ===================================================================
router.get('/saldo', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN buchungsart = 'einnahme' THEN betrag_brutto ELSE -betrag_brutto END) AS kassenstand,
         MAX(buchungsdatum) AS letzte_buchung
       FROM buchhaltung_kasse
       WHERE dojo_id = ?`,
      [dojoId]
    );

    const kassenstand = parseFloat(rows[0]?.kassenstand) || 0;
    const letzte_buchung = rows[0]?.letzte_buchung || null;

    res.json({
      kassenstand: Math.round(kassenstand * 100) / 100,
      letzte_buchung
    });
  } catch (err) {
    console.error('[buchhaltung-kasse] GET /saldo Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Laden des Saldos' });
  }
});

// ===================================================================
// GET / — Kassenbucheinträge mit optionaler Filterung
// Query-Params: ?jahr=2024&quartal=1&buchungsart=ausgabe
// ===================================================================
router.get('/', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const jahr = req.query.jahr ? parseInt(req.query.jahr) : null;
  const quartal = req.query.quartal ? parseInt(req.query.quartal) : null;
  const buchungsart = req.query.buchungsart || null;

  try {
    let where = 'WHERE dojo_id = ?';
    const params = [dojoId];

    if (jahr) {
      where += ' AND YEAR(buchungsdatum) = ?';
      params.push(jahr);
    }

    if (quartal && quartal >= 1 && quartal <= 4) {
      // Quartal 1 = Monate 1-3, Q2 = 4-6, Q3 = 7-9, Q4 = 10-12
      const monatVon = (quartal - 1) * 3 + 1;
      const monatBis = monatVon + 2;
      where += ' AND MONTH(buchungsdatum) BETWEEN ? AND ?';
      params.push(monatVon, monatBis);
    }

    if (buchungsart && ['einnahme', 'ausgabe'].includes(buchungsart)) {
      where += ' AND buchungsart = ?';
      params.push(buchungsart);
    }

    const [eintraege] = await pool.query(
      `SELECT * FROM buchhaltung_kasse ${where} ORDER BY buchungsdatum DESC, kasse_id DESC`,
      params
    );

    // Numerische Felder sauber parsen
    const parsedEintraege = eintraege.map((e) => ({
      ...e,
      betrag_brutto: parseFloat(e.betrag_brutto),
      mwst_satz: parseFloat(e.mwst_satz),
      mwst_betrag: parseFloat(e.mwst_betrag),
      betrag_netto: parseFloat(e.betrag_netto)
    }));

    // Saldo und Summen berechnen
    let summe_einnahmen = 0;
    let summe_ausgaben = 0;

    for (const e of parsedEintraege) {
      if (e.buchungsart === 'einnahme') {
        summe_einnahmen += e.betrag_brutto;
      } else {
        summe_ausgaben += e.betrag_brutto;
      }
    }

    const saldo = summe_einnahmen - summe_ausgaben;

    // Laufenden Kassenstand berechnen (kumulativ, älteste zuerst, dann umkehren)
    // Da nach buchungsdatum DESC sortiert, rückwärts aufaddieren
    let laufend = saldo;
    const mitKassenstand = parsedEintraege.map((e) => {
      const eintrag = { ...e, kassenstand_nach_buchung: Math.round(laufend * 100) / 100 };
      // Für den nächsten (älteren) Eintrag den Betrag rückgängig machen
      if (e.buchungsart === 'einnahme') {
        laufend -= e.betrag_brutto;
      } else {
        laufend += e.betrag_brutto;
      }
      return eintrag;
    });

    res.json({
      eintraege: mitKassenstand,
      saldo: Math.round(saldo * 100) / 100,
      summe_einnahmen: Math.round(summe_einnahmen * 100) / 100,
      summe_ausgaben: Math.round(summe_ausgaben * 100) / 100,
      kassenstand: Math.round(saldo * 100) / 100
    });
  } catch (err) {
    console.error('[buchhaltung-kasse] GET / Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Kassenbucheinträge' });
  }
});

// ===================================================================
// POST / — Neuen Kassenbucheintrag anlegen
// ===================================================================
router.post('/', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const {
    buchungsdatum,
    buchungstext,
    buchungsart,
    betrag_brutto,
    mwst_satz = 19,
    kategorie = 'sonstige_kosten',
    beleg_nr = null,
    notiz = null
  } = req.body;

  // Pflichtfelder prüfen
  if (!buchungsdatum || !buchungstext || !buchungsart || betrag_brutto == null) {
    return res.status(400).json({
      error: 'Pflichtfelder fehlen: buchungsdatum, buchungstext, buchungsart, betrag_brutto'
    });
  }

  if (!['einnahme', 'ausgabe'].includes(buchungsart)) {
    return res.status(400).json({ error: 'buchungsart muss "einnahme" oder "ausgabe" sein' });
  }

  if (parseFloat(betrag_brutto) <= 0) {
    return res.status(400).json({ error: 'betrag_brutto muss größer als 0 sein' });
  }

  const brutto = parseFloat(betrag_brutto);
  const satz = parseFloat(mwst_satz);
  const { mwst_betrag, betrag_netto } = berechneMwst(brutto, satz);

  try {
    const [result] = await pool.query(
      `INSERT INTO buchhaltung_kasse
        (dojo_id, buchungsdatum, buchungstext, buchungsart, betrag_brutto,
         mwst_satz, mwst_betrag, betrag_netto, kategorie, beleg_nr, notiz)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dojoId, buchungsdatum, buchungstext, buchungsart,
        brutto, satz, mwst_betrag, betrag_netto,
        kategorie, beleg_nr || null, notiz || null
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM buchhaltung_kasse WHERE kasse_id = ?',
      [result.insertId]
    );

    const eintrag = rows[0];
    res.status(201).json({
      success: true,
      eintrag: {
        ...eintrag,
        betrag_brutto: parseFloat(eintrag.betrag_brutto),
        mwst_betrag: parseFloat(eintrag.mwst_betrag),
        betrag_netto: parseFloat(eintrag.betrag_netto)
      }
    });
  } catch (err) {
    console.error('[buchhaltung-kasse] POST / Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Anlegen des Eintrags' });
  }
});

// ===================================================================
// PUT /:id — Eintrag aktualisieren
// ===================================================================
router.put('/:id', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const kasseId = parseInt(req.params.id);
  if (!kasseId) {
    return res.status(400).json({ error: 'Ungültige kasse_id' });
  }

  try {
    // Ownership prüfen
    const [existing] = await pool.query(
      'SELECT kasse_id FROM buchhaltung_kasse WHERE kasse_id = ? AND dojo_id = ?',
      [kasseId, dojoId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden oder kein Zugriff' });
    }

    const {
      buchungsdatum,
      buchungstext,
      buchungsart,
      betrag_brutto,
      mwst_satz,
      kategorie,
      beleg_nr,
      notiz
    } = req.body;

    // Wenn buchungsart vorhanden, validieren
    if (buchungsart && !['einnahme', 'ausgabe'].includes(buchungsart)) {
      return res.status(400).json({ error: 'buchungsart muss "einnahme" oder "ausgabe" sein' });
    }

    // MwSt neu berechnen wenn Betrag oder Satz geändert wird
    let mwst_betrag;
    let betrag_netto;
    if (betrag_brutto != null || mwst_satz != null) {
      // Aktuellen Datensatz laden um fehlende Werte zu ergänzen
      const [currentRows] = await pool.query(
        'SELECT betrag_brutto, mwst_satz FROM buchhaltung_kasse WHERE kasse_id = ?',
        [kasseId]
      );
      const current = currentRows[0];
      const neuesBrutto = betrag_brutto != null ? parseFloat(betrag_brutto) : parseFloat(current.betrag_brutto);
      const neuerSatz = mwst_satz != null ? parseFloat(mwst_satz) : parseFloat(current.mwst_satz);
      const berechnet = berechneMwst(neuesBrutto, neuerSatz);
      mwst_betrag = berechnet.mwst_betrag;
      betrag_netto = berechnet.betrag_netto;
    }

    // Dynamisches UPDATE nur mit geänderten Feldern
    const felder = {};
    if (buchungsdatum !== undefined) felder.buchungsdatum = buchungsdatum;
    if (buchungstext !== undefined) felder.buchungstext = buchungstext;
    if (buchungsart !== undefined) felder.buchungsart = buchungsart;
    if (betrag_brutto != null) felder.betrag_brutto = parseFloat(betrag_brutto);
    if (mwst_satz != null) felder.mwst_satz = parseFloat(mwst_satz);
    if (mwst_betrag !== undefined) felder.mwst_betrag = mwst_betrag;
    if (betrag_netto !== undefined) felder.betrag_netto = betrag_netto;
    if (kategorie !== undefined) felder.kategorie = kategorie;
    if (beleg_nr !== undefined) felder.beleg_nr = beleg_nr;
    if (notiz !== undefined) felder.notiz = notiz;

    if (Object.keys(felder).length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren angegeben' });
    }

    const setClause = Object.keys(felder).map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(felder), kasseId, dojoId];

    await pool.query(
      `UPDATE buchhaltung_kasse SET ${setClause} WHERE kasse_id = ? AND dojo_id = ?`,
      values
    );

    const [rows] = await pool.query('SELECT * FROM buchhaltung_kasse WHERE kasse_id = ?', [kasseId]);
    const eintrag = rows[0];

    res.json({
      success: true,
      eintrag: {
        ...eintrag,
        betrag_brutto: parseFloat(eintrag.betrag_brutto),
        mwst_betrag: parseFloat(eintrag.mwst_betrag),
        betrag_netto: parseFloat(eintrag.betrag_netto)
      }
    });
  } catch (err) {
    console.error('[buchhaltung-kasse] PUT /:id Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren' });
  }
});

// ===================================================================
// DELETE /:id — Hard-Delete mit Ownership-Prüfung
// ===================================================================
router.delete('/:id', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const kasseId = parseInt(req.params.id);
  if (!kasseId) {
    return res.status(400).json({ error: 'Ungültige kasse_id' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT kasse_id FROM buchhaltung_kasse WHERE kasse_id = ? AND dojo_id = ?',
      [kasseId, dojoId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden oder kein Zugriff' });
    }

    await pool.query(
      'DELETE FROM buchhaltung_kasse WHERE kasse_id = ? AND dojo_id = ?',
      [kasseId, dojoId]
    );

    res.json({ success: true, message: 'Eintrag gelöscht' });
  } catch (err) {
    console.error('[buchhaltung-kasse] DELETE /:id Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Löschen' });
  }
});

module.exports = router;
