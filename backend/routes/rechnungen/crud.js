/**
 * Rechnungen CRUD Routes
 * Liste, Details, Erstellen, Aktualisieren, Löschen
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { generateAndSaveRechnungPDF, generatePDFFromHTML } = require('./shared');

// GET / - Alle Rechnungen mit Filter
router.get('/', (req, res) => {
  const { status, mitglied_id, von, bis, art, archiviert } = req.query;

  let query = `
    SELECT
      r.*,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
      m.email,
      (SELECT COUNT(*) FROM rechnungspositionen WHERE rechnung_id = r.rechnung_id) as anzahl_positionen,
      (SELECT COALESCE(SUM(betrag), 0) FROM zahlungen WHERE rechnung_id = r.rechnung_id) as bezahlter_betrag,
      CASE
        WHEN r.status = 'bezahlt' THEN 'Bezahlt'
        WHEN r.faelligkeitsdatum < CURDATE() AND r.status = 'offen' THEN 'Überfällig'
        ELSE 'Offen'
      END as status_text
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE 1=1
  `;

  const params = [];

  if (status) {
    query += ` AND r.status = ?`;
    params.push(status);
  }

  if (mitglied_id) {
    query += ` AND r.mitglied_id = ?`;
    params.push(mitglied_id);
  }

  if (von) {
    query += ` AND r.datum >= ?`;
    params.push(von);
  }

  if (bis) {
    query += ` AND r.datum <= ?`;
    params.push(bis);
  }

  if (art) {
    query += ` AND r.art = ?`;
    params.push(art);
  }

  if (archiviert !== undefined) {
    query += ` AND r.archiviert = ?`;
    params.push(archiviert === 'true' ? 1 : 0);
  }

  query += ` ORDER BY r.datum DESC, r.rechnung_id DESC`;

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Rechnungen:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results });
  });
});

// GET /naechste-nummer - Nächste Rechnungsnummer für Datum
router.get('/naechste-nummer', (req, res) => {
  const { datum } = req.query;

  if (!datum) {
    return res.status(400).json({ success: false, error: 'Datum erforderlich' });
  }

  const datumObj = new Date(datum);
  const jahr = datumObj.getFullYear();
  const monat = String(datumObj.getMonth() + 1).padStart(2, '0');
  const tag = String(datumObj.getDate()).padStart(2, '0');
  const datumPrefix = `${jahr}/${monat}/${tag}`;

  // Zähle ALLE Rechnungen aus beiden Tabellen für dieses Jahr (fortlaufend)
  const checkQuery = `
    SELECT
      (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
      (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
    AS count
  `;

  db.query(checkQuery, [jahr, jahr], (err, results) => {
    if (err) {
      logger.error('Fehler beim Ermitteln der nächsten Nummer:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    const count = results[0].count;
    const laufnummer = 1000 + count;
    const rechnungsnummer = `${datumPrefix}-${laufnummer}`;

    res.json({ success: true, rechnungsnummer: rechnungsnummer });
  });
});

// GET /statistiken - Statistiken für Dashboard
router.get('/statistiken', (req, res) => {
  const query = `
    SELECT
      COUNT(*) as gesamt_rechnungen,
      COUNT(CASE WHEN status = 'offen' THEN 1 END) as offene_rechnungen,
      COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlte_rechnungen,
      COUNT(CASE WHEN status = 'ueberfaellig' OR (faelligkeitsdatum < CURDATE() AND status = 'offen') THEN 1 END) as ueberfaellige_rechnungen,
      COALESCE(SUM(CASE WHEN status = 'offen' THEN betrag ELSE 0 END), 0) as offene_summe,
      COALESCE(SUM(CASE WHEN status = 'bezahlt' THEN betrag ELSE 0 END), 0) as bezahlte_summe,
      COALESCE(SUM(CASE WHEN status = 'ueberfaellig' OR (faelligkeitsdatum < CURDATE() AND status = 'offen') THEN betrag ELSE 0 END), 0) as ueberfaellige_summe,
      COALESCE(SUM(betrag), 0) as gesamt_summe
    FROM rechnungen
    WHERE archiviert = 0
  `;

  db.query(query, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Statistiken:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results[0] });
  });
});

// GET /:id - Einzelne Rechnung mit Details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const rechnungQuery = `
    SELECT
      r.*,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
      m.email,
      m.telefon,
      m.plz,
      m.ort
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE r.rechnung_id = ?
  `;

  db.query(rechnungQuery, [id], (err, rechnungResults) => {
    if (err) {
      logger.error('Fehler beim Laden der Rechnung:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    if (rechnungResults.length === 0) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden' });
    }

    const rechnung = rechnungResults[0];

    // Lade Positionen
    const positionenQuery = `SELECT * FROM rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr`;

    db.query(positionenQuery, [id], (posErr, positionen) => {
      if (posErr) {
        logger.error('Fehler beim Laden der Positionen:', { error: posErr });
        return res.status(500).json({ success: false, error: posErr.message });
      }

      // Lade Zahlungen
      const zahlungenQuery = `SELECT * FROM zahlungen WHERE rechnung_id = ? ORDER BY zahlungsdatum DESC`;

      db.query(zahlungenQuery, [id], (zahlErr, zahlungen) => {
        if (zahlErr) {
          logger.error('Fehler beim Laden der Zahlungen:', { error: zahlErr });
          return res.status(500).json({ success: false, error: zahlErr.message });
        }

        rechnung.positionen = positionen;
        rechnung.zahlungen = zahlungen;

        res.json({ success: true, data: rechnung });
      });
    });
  });
});

// POST / - Neue Rechnung erstellen
router.post('/', (req, res) => {
  const {
    mitglied_id,
    datum,
    faelligkeitsdatum,
    art,
    beschreibung,
    notizen,
    positionen,
    mwst_satz,
    pdfHtml  // NEU: HTML für PDF-Generierung aus Frontend
  } = req.body;

  // Validierung
  if (!mitglied_id || !datum || !faelligkeitsdatum || !art || !positionen || positionen.length === 0) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
  }

  // Berechne Beträge
  let netto_betrag = 0;
  positionen.forEach(pos => {
    netto_betrag += parseFloat(pos.gesamtpreis || 0);
  });

  const mwst_satz_num = parseFloat(mwst_satz || 19.0);
  const mwst_betrag = netto_betrag * (mwst_satz_num / 100);
  const brutto_betrag = netto_betrag + mwst_betrag;

  // Generiere Rechnungsnummer im Format yyyy/mm/dd-1000
  const datumObj = new Date(datum);
  const jahr = datumObj.getFullYear();
  const monat = String(datumObj.getMonth() + 1).padStart(2, '0');
  const tag = String(datumObj.getDate()).padStart(2, '0');
  const datumPrefix = `${jahr}/${monat}/${tag}`;

  // Zähle ALLE Rechnungen aus beiden Tabellen für dieses Jahr (fortlaufend)
  const checkQuery = `
    SELECT
      (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
      (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
    AS count
  `;

  db.query(checkQuery, [jahr, jahr], (checkErr, checkResults) => {
    if (checkErr) {
      logger.error('Fehler beim Prüfen der Rechnungsnummer:', { error: checkErr });
      return res.status(500).json({ success: false, error: checkErr.message });
    }

    const count = checkResults[0].count;
    const laufnummer = 1000 + count;
    const rechnungsnummer = `${datumPrefix}-${laufnummer}`;

    // Rechnung einfügen
    const insertQuery = `
      INSERT INTO rechnungen (
        rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
        betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag,
        art, beschreibung, notizen, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen')
    `;

    const values = [
      rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
      brutto_betrag, netto_betrag, brutto_betrag, mwst_satz_num, mwst_betrag,
      art, beschreibung, notizen
    ];

    db.query(insertQuery, values, (insertErr, insertResult) => {
      if (insertErr) {
        logger.error('Fehler beim Erstellen der Rechnung:', { error: insertErr });
        return res.status(500).json({ success: false, error: insertErr.message });
      }

      const rechnung_id = insertResult.insertId;

      // Positionen einfügen
      const positionenInserts = positionen.map((pos, index) => {
        return new Promise((resolve, reject) => {
          const posQuery = `
            INSERT INTO rechnungspositionen (
              rechnung_id, position_nr, bezeichnung, menge, einzelpreis, gesamtpreis, mwst_satz, beschreibung
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(posQuery, [
            rechnung_id,
            index + 1,
            pos.bezeichnung,
            pos.menge || 1,
            pos.einzelpreis,
            pos.gesamtpreis,
            pos.mwst_satz || mwst_satz_num,
            pos.beschreibung || null
          ], (posErr) => {
            if (posErr) reject(posErr);
            else resolve();
          });
        });
      });

      Promise.all(positionenInserts)
        .then(async () => {
          // Generiere und speichere PDF im Hintergrund
          try {
            if (pdfHtml) {
              // Nutze Frontend-HTML für PDF-Generierung
              await generatePDFFromHTML(rechnung_id, pdfHtml);
              logger.debug(`PDF aus Frontend-HTML für Rechnung ${rechnungsnummer} wurde erstellt`);
            } else {
              // Fallback: Nutze Backend-Template
              await generateAndSaveRechnungPDF(rechnung_id);
              logger.debug(`PDF für Rechnung ${rechnungsnummer} wurde erstellt`);
            }
          } catch (pdfErr) {
            logger.error('PDF-Generierung fehlgeschlagen (Rechnung wurde trotzdem erstellt):', { error: pdfErr });
            // Fehler nicht weitergeben, da Rechnung erfolgreich erstellt wurde
          }

          res.json({
            success: true,
            message: 'Rechnung erfolgreich erstellt',
            rechnung_id: rechnung_id,
            rechnungsnummer: rechnungsnummer
          });
        })
        .catch(posErr => {
          logger.error('Fehler beim Einfügen der Positionen:', { error: posErr });
          res.status(500).json({ success: false, error: posErr.message });
        });
    });
  });
});

// PUT /:id - Rechnung aktualisieren
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, beschreibung, notizen, bezahlt_am, zahlungsart } = req.body;

  const updateQuery = `
    UPDATE rechnungen
    SET status = ?, beschreibung = ?, notizen = ?, bezahlt_am = ?, zahlungsart = ?
    WHERE rechnung_id = ?
  `;

  db.query(updateQuery, [status, beschreibung, notizen, bezahlt_am, zahlungsart, id], (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren der Rechnung:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: 'Rechnung aktualisiert' });
  });
});

// PUT /:id/archivieren - Rechnung archivieren
router.put('/:id/archivieren', (req, res) => {
  const { id } = req.params;
  const { archiviert } = req.body;

  const query = `UPDATE rechnungen SET archiviert = ? WHERE rechnung_id = ?`;

  db.query(query, [archiviert ? 1 : 0, id], (err) => {
    if (err) {
      logger.error('Fehler beim Archivieren:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: archiviert ? 'Rechnung archiviert' : 'Archivierung aufgehoben' });
  });
});

// DELETE /:id - Rechnung löschen
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM rechnungen WHERE rechnung_id = ?`;

  db.query(query, [id], (err) => {
    if (err) {
      logger.error('Fehler beim Löschen der Rechnung:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: 'Rechnung gelöscht' });
  });
});

module.exports = router;
