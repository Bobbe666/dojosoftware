/**
 * Buchhaltung AfA — Abschreibungen (Depreciation)
 * =================================================
 * Verwaltung von Anlagegütern und deren AfA-Berechnung nach deutschem Steuerrecht.
 * - Lineare AfA: Gleichmäßige Verteilung der Anschaffungskosten über die Nutzungsdauer
 * - GWG: Geringwertige Wirtschaftsgüter (≤ €800 netto) — Sofortabschreibung im Anschaffungsjahr
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

// Helper: AfA-Berechnung für ein Anlagegut
function berechneAfa(anlage) {
  const netto = parseFloat(anlage.anschaffungskosten_netto);
  const nutzungsdauer = parseInt(anlage.nutzungsdauer_jahre);
  const afa_art = anlage.afa_art;

  // Jahres-AfA
  let jahres_afa;
  if (afa_art === 'gwg') {
    // GWG: Sofortabschreibung im Anschaffungsjahr
    jahres_afa = netto;
  } else {
    // Linear: gleichmäßig über Nutzungsdauer
    jahres_afa = netto / nutzungsdauer;
  }

  // Berechne abgeschriebene Jahre basierend auf Anschaffungsdatum
  const anschaffungsDatum = new Date(anlage.anschaffungsdatum);
  const heute = new Date();
  const anschaffungsJahr = anschaffungsDatum.getFullYear();
  const aktuellesJahr = heute.getFullYear();

  let abgeschriebeneJahre;
  if (afa_art === 'gwg') {
    // GWG: vollständig abgeschrieben nach dem Anschaffungsjahr
    abgeschriebeneJahre = aktuellesJahr > anschaffungsJahr ? 1 : 0;
  } else {
    abgeschriebeneJahre = aktuellesJahr - anschaffungsJahr;
    // Cap auf Nutzungsdauer
    abgeschriebeneJahre = Math.min(abgeschriebeneJahre, nutzungsdauer);
  }

  const bereits_abgeschrieben = Math.min(jahres_afa * abgeschriebeneJahre, netto);
  const buchwert_aktuell = Math.max(netto - bereits_abgeschrieben, 0);
  const vollstaendig_abgeschrieben = buchwert_aktuell <= 0;

  return {
    jahres_afa: Math.round(jahres_afa * 100) / 100,
    bereits_abgeschrieben: Math.round(bereits_abgeschrieben * 100) / 100,
    buchwert_aktuell: Math.round(buchwert_aktuell * 100) / 100,
    vollstaendig_abgeschrieben
  };
}

// ===================================================================
// POST /init — Tabelle anlegen
// ===================================================================
router.post('/init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buchhaltung_anlagen (
        anlage_id INT AUTO_INCREMENT PRIMARY KEY,
        dojo_id INT NOT NULL,
        bezeichnung VARCHAR(255) NOT NULL,
        anschaffungsdatum DATE NOT NULL,
        anschaffungskosten_brutto DECIMAL(10,2) NOT NULL,
        anschaffungskosten_netto DECIMAL(10,2) NOT NULL,
        mwst_satz DECIMAL(5,2) DEFAULT 19,
        nutzungsdauer_jahre INT NOT NULL,
        afa_art ENUM('linear','gwg') DEFAULT 'linear',
        kategorie VARCHAR(100) DEFAULT 'abschreibungen',
        beleg_nr VARCHAR(100),
        notiz TEXT,
        aktiv TINYINT(1) DEFAULT 1,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dojo_id (dojo_id)
      )
    `);
    res.json({ success: true, message: 'Tabelle buchhaltung_anlagen erstellt oder bereits vorhanden' });
  } catch (err) {
    console.error('[buchhaltung-afa] /init Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Initialisieren' });
  }
});

// ===================================================================
// GET / — Alle Anlagegüter des Dojos mit AfA-Berechnung
// ===================================================================
router.get('/', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM buchhaltung_anlagen
       WHERE dojo_id = ? AND aktiv = 1
       ORDER BY anschaffungsdatum DESC`,
      [dojoId]
    );

    // AfA für jedes Anlagegut berechnen
    const anlagen = rows.map((anlage) => {
      const afa = berechneAfa(anlage);
      return {
        ...anlage,
        anschaffungskosten_netto: parseFloat(anlage.anschaffungskosten_netto),
        anschaffungskosten_brutto: parseFloat(anlage.anschaffungskosten_brutto),
        mwst_satz: parseFloat(anlage.mwst_satz),
        ...afa
      };
    });

    // Gesamtsummen
    const gesamt_netto = anlagen.reduce((s, a) => s + a.anschaffungskosten_netto, 0);
    const jahres_afa_gesamt = anlagen
      .filter((a) => !a.vollstaendig_abgeschrieben)
      .reduce((s, a) => s + a.jahres_afa, 0);
    const buchwert_gesamt = anlagen.reduce((s, a) => s + a.buchwert_aktuell, 0);

    res.json({
      anlagen,
      summen: {
        gesamt_netto: Math.round(gesamt_netto * 100) / 100,
        jahres_afa_gesamt: Math.round(jahres_afa_gesamt * 100) / 100,
        buchwert_gesamt: Math.round(buchwert_gesamt * 100) / 100
      }
    });
  } catch (err) {
    console.error('[buchhaltung-afa] GET / Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Anlagegüter' });
  }
});

// ===================================================================
// POST / — Neues Anlagegut anlegen
// ===================================================================
router.post('/', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const {
    bezeichnung,
    anschaffungsdatum,
    anschaffungskosten_brutto,
    anschaffungskosten_netto,
    mwst_satz = 19,
    nutzungsdauer_jahre,
    afa_art = 'linear',
    kategorie = 'abschreibungen',
    beleg_nr = null,
    notiz = null
  } = req.body;

  // Pflichtfelder prüfen
  if (!bezeichnung || !anschaffungsdatum || anschaffungskosten_brutto == null ||
      anschaffungskosten_netto == null || !nutzungsdauer_jahre) {
    return res.status(400).json({
      error: 'Pflichtfelder fehlen: bezeichnung, anschaffungsdatum, anschaffungskosten_brutto, anschaffungskosten_netto, nutzungsdauer_jahre'
    });
  }

  if (!['linear', 'gwg'].includes(afa_art)) {
    return res.status(400).json({ error: 'afa_art muss "linear" oder "gwg" sein' });
  }

  if (parseInt(nutzungsdauer_jahre) < 1) {
    return res.status(400).json({ error: 'Nutzungsdauer muss mindestens 1 Jahr betragen' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO buchhaltung_anlagen
        (dojo_id, bezeichnung, anschaffungsdatum, anschaffungskosten_brutto,
         anschaffungskosten_netto, mwst_satz, nutzungsdauer_jahre, afa_art,
         kategorie, beleg_nr, notiz)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dojoId, bezeichnung, anschaffungsdatum,
        parseFloat(anschaffungskosten_brutto), parseFloat(anschaffungskosten_netto),
        parseFloat(mwst_satz), parseInt(nutzungsdauer_jahre),
        afa_art, kategorie, beleg_nr || null, notiz || null
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM buchhaltung_anlagen WHERE anlage_id = ?',
      [result.insertId]
    );
    const anlage = rows[0];
    const afa = berechneAfa(anlage);

    res.status(201).json({ success: true, anlage: { ...anlage, ...afa } });
  } catch (err) {
    console.error('[buchhaltung-afa] POST / Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Erstellen des Anlageguts' });
  }
});

// ===================================================================
// PUT /:id — Anlagegut aktualisieren (nur erlaubte Felder)
// ===================================================================
router.put('/:id', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const anlageId = parseInt(req.params.id);
  if (!anlageId) {
    return res.status(400).json({ error: 'Ungültige anlage_id' });
  }

  // Nur diese Felder dürfen geändert werden (keine nachträgliche Änderung von
  // Anschaffungskosten oder -datum — wäre GoB-widrig)
  const erlaubteFelder = ['bezeichnung', 'nutzungsdauer_jahre', 'kategorie', 'beleg_nr', 'notiz', 'aktiv'];
  const updates = {};
  for (const feld of erlaubteFelder) {
    if (req.body[feld] !== undefined) {
      updates[feld] = req.body[feld];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Keine aktualisierbare Felder angegeben' });
  }

  try {
    // Ownership prüfen
    const [existing] = await pool.query(
      'SELECT anlage_id FROM buchhaltung_anlagen WHERE anlage_id = ? AND dojo_id = ?',
      [anlageId, dojoId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Anlagegut nicht gefunden oder kein Zugriff' });
    }

    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), anlageId, dojoId];

    await pool.query(
      `UPDATE buchhaltung_anlagen SET ${setClause} WHERE anlage_id = ? AND dojo_id = ?`,
      values
    );

    const [rows] = await pool.query('SELECT * FROM buchhaltung_anlagen WHERE anlage_id = ?', [anlageId]);
    const anlage = rows[0];
    const afa = berechneAfa(anlage);

    res.json({ success: true, anlage: { ...anlage, ...afa } });
  } catch (err) {
    console.error('[buchhaltung-afa] PUT /:id Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Aktualisieren' });
  }
});

// ===================================================================
// DELETE /:id — Soft-Delete (aktiv = 0)
// ===================================================================
router.delete('/:id', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const anlageId = parseInt(req.params.id);
  if (!anlageId) {
    return res.status(400).json({ error: 'Ungültige anlage_id' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT anlage_id FROM buchhaltung_anlagen WHERE anlage_id = ? AND dojo_id = ? AND aktiv = 1',
      [anlageId, dojoId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Anlagegut nicht gefunden oder kein Zugriff' });
    }

    await pool.query(
      'UPDATE buchhaltung_anlagen SET aktiv = 0 WHERE anlage_id = ? AND dojo_id = ?',
      [anlageId, dojoId]
    );

    res.json({ success: true, message: 'Anlagegut deaktiviert' });
  } catch (err) {
    console.error('[buchhaltung-afa] DELETE /:id Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Deaktivieren' });
  }
});

// ===================================================================
// GET /jahresuebersicht/:jahr — AfA-Buchungen für ein Kalenderjahr
// ===================================================================
// WICHTIG: Diese Route muss VOR einer etwaigen /:id-Route stehen, damit
// "jahresuebersicht" nicht als ID interpretiert wird.
router.get('/jahresuebersicht/:jahr', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) {
    return res.status(400).json({ error: 'Keine dojo_id verfügbar' });
  }

  const jahr = parseInt(req.params.jahr);
  if (!jahr || jahr < 2000 || jahr > 2100) {
    return res.status(400).json({ error: 'Ungültiges Jahr' });
  }

  try {
    // Alle aktiven Anlagen laden, deren Anschaffungsjahr <= gesuchtes Jahr
    const [rows] = await pool.query(
      `SELECT * FROM buchhaltung_anlagen
       WHERE dojo_id = ? AND aktiv = 1
         AND YEAR(anschaffungsdatum) <= ?
       ORDER BY anschaffungsdatum ASC`,
      [dojoId, jahr]
    );

    const eintraege = [];

    for (const anlage of rows) {
      const netto = parseFloat(anlage.anschaffungskosten_netto);
      const nutzungsdauer = parseInt(anlage.nutzungsdauer_jahre);
      const afa_art = anlage.afa_art;
      const anschaffungsJahr = new Date(anlage.anschaffungsdatum).getFullYear();

      let jahres_afa;
      let relevantesFahr = false;

      if (afa_art === 'gwg') {
        // GWG: nur im Anschaffungsjahr abschreiben
        jahres_afa = netto;
        relevantesFahr = anschaffungsJahr === jahr;
      } else {
        // Linear: in jedem Jahr der Nutzungsdauer
        jahres_afa = netto / nutzungsdauer;
        const letztes_afa_jahr = anschaffungsJahr + nutzungsdauer - 1;
        relevantesFahr = jahr >= anschaffungsJahr && jahr <= letztes_afa_jahr;
      }

      if (relevantesFahr) {
        eintraege.push({
          anlage_id: anlage.anlage_id,
          bezeichnung: anlage.bezeichnung,
          afa_art: anlage.afa_art,
          anschaffungsdatum: anlage.anschaffungsdatum,
          anschaffungskosten_netto: netto,
          jahres_afa: Math.round(jahres_afa * 100) / 100,
          buchungsdatum: `${jahr}-12-31`,
          kategorie: anlage.kategorie
        });
      }
    }

    const summe_afa_jahr = eintraege.reduce((s, e) => s + e.jahres_afa, 0);

    res.json({
      jahr,
      eintraege,
      summe_afa_jahr: Math.round(summe_afa_jahr * 100) / 100
    });
  } catch (err) {
    console.error('[buchhaltung-afa] GET /jahresuebersicht/:jahr Fehler:', err);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Jahresübersicht' });
  }
});

module.exports = router;
