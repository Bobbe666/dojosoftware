/**
 * Rechnungen CRUD Routes
 * Liste, Details, Erstellen, Aktualisieren, Löschen
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { generateAndSaveRechnungPDF, generatePDFFromHTML } = require('./shared');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');

// GET / - Alle Rechnungen mit Filter
router.get('/', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  const { status, mitglied_id, von, bis, art, archiviert } = req.query;

  let query = `
    SELECT
      r.*,
      COALESCE(CONCAT(m.vorname, ' ', m.nachname), r.extern_name) as mitglied_name,
      COALESCE(m.email, r.extern_email) as email,
      (SELECT COUNT(*) FROM rechnungspositionen WHERE rechnung_id = r.rechnung_id) as anzahl_positionen,
      (SELECT COALESCE(SUM(betrag), 0) FROM zahlungen WHERE rechnung_id = r.rechnung_id) as bezahlter_betrag,
      CASE
        WHEN r.status = 'bezahlt' THEN 'Bezahlt'
        WHEN r.faelligkeitsdatum < CURDATE() AND r.status = 'offen' THEN 'Überfällig'
        ELSE 'Offen'
      END as status_text,
      (SELECT MAX(erstellt_am) FROM rechnung_aktionen WHERE rechnung_id = r.rechnung_id AND aktion_typ = 'email_gesendet') as email_gesendet_am,
      (SELECT COUNT(*) FROM rechnung_aktionen WHERE rechnung_id = r.rechnung_id AND aktion_typ = 'email_gesendet') as email_gesendet_anzahl,
      (SELECT MAX(erstellt_am) FROM rechnung_aktionen WHERE rechnung_id = r.rechnung_id AND aktion_typ = 'gedruckt') as gedruckt_am,
      (SELECT MAX(erstellt_am) FROM rechnung_aktionen WHERE rechnung_id = r.rechnung_id AND aktion_typ = 'lastschrift_eingezogen') as lastschrift_am
    FROM rechnungen r
    LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE 1=1
  `;

  const params = [];

  // 🔒 Dojo-Isolation: Nur eigene Rechnungen (Mitglieder oder Extern mit dojo_id)
  if (secureDojoId) {
    query += ` AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))`;
    params.push(secureDojoId, secureDojoId);
  }

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
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  const { datum } = req.query;

  if (!datum) {
    return res.status(400).json({ success: false, error: 'Datum erforderlich' });
  }

  const datumObj = new Date(datum);
  const jahr = datumObj.getFullYear();
  const monat = String(datumObj.getMonth() + 1).padStart(2, '0');
  const tag = String(datumObj.getDate()).padStart(2, '0');
  const datumPrefix = `${jahr}/${monat}/${tag}`;

  let checkQuery;
  let checkParams;

  if (secureDojoId) {
    // Kundendojo: Nur eigene Rechnungen zählen
    checkQuery = `
      SELECT COUNT(*) AS count
      FROM rechnungen r
      LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      WHERE YEAR(r.datum) = ? AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))
    `;
    checkParams = [jahr, secureDojoId, secureDojoId];
  } else {
    // Super-Admin: Alle Rechnungen + Verband-Zahlungen (plattformweite Nummerierung)
    checkQuery = `
      SELECT
        (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
        (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
      AS count
    `;
    checkParams = [jahr, jahr];
  }

  db.query(checkQuery, checkParams, (err, results) => {
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
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

  let query;
  let params = [];

  if (secureDojoId) {
    // Kundendojo: Nur eigene Rechnungen über Mitglieder-JOIN
    query = `
      SELECT
        COUNT(*) as gesamt_rechnungen,
        COUNT(CASE WHEN r.status = 'offen' THEN 1 END) as offene_rechnungen,
        COUNT(CASE WHEN r.status = 'bezahlt' THEN 1 END) as bezahlte_rechnungen,
        COUNT(CASE WHEN r.status = 'ueberfaellig' OR (r.faelligkeitsdatum < CURDATE() AND r.status = 'offen') THEN 1 END) as ueberfaellige_rechnungen,
        COALESCE(SUM(CASE WHEN r.status = 'offen' THEN r.betrag ELSE 0 END), 0) as offene_summe,
        COALESCE(SUM(CASE WHEN r.status = 'bezahlt' THEN r.betrag ELSE 0 END), 0) as bezahlte_summe,
        COALESCE(SUM(CASE WHEN r.status = 'ueberfaellig' OR (r.faelligkeitsdatum < CURDATE() AND r.status = 'offen') THEN r.betrag ELSE 0 END), 0) as ueberfaellige_summe,
        COALESCE(SUM(r.betrag), 0) as gesamt_summe
      FROM rechnungen r
      LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      WHERE r.archiviert = 0 AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))
    `;
    params = [secureDojoId, secureDojoId];
  } else {
    query = `
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
  }

  db.query(query, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Statistiken:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results[0] });
  });
});

// GET /:id - Einzelne Rechnung mit Details
router.get('/:id', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const { id } = req.params;

  let rechnungQuery = `
    SELECT
      r.*,
      COALESCE(CONCAT(m.vorname, ' ', m.nachname), r.extern_name) as mitglied_name,
      COALESCE(m.email, r.extern_email) as email,
      m.telefon,
      m.plz,
      m.ort
    FROM rechnungen r
    LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE r.rechnung_id = ?
  `;
  const rechnungParams = [id];

  if (secureDojoId) {
    rechnungQuery += ` AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))`;
    rechnungParams.push(secureDojoId, secureDojoId);
  }

  db.query(rechnungQuery, rechnungParams, (err, rechnungResults) => {
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
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);

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

  // 🔒 Dojo-Check: mitglied_id muss zum eigenen Dojo gehören
  const dojoCheckQuery = secureDojoId
    ? `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`
    : `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ?`;
  const dojoCheckParams = secureDojoId ? [mitglied_id, secureDojoId] : [mitglied_id];

  db.query(dojoCheckQuery, dojoCheckParams, (dojoErr, dojoResults) => {
    if (dojoErr) {
      logger.error('Fehler beim Dojo-Check:', { error: dojoErr });
      return res.status(500).json({ success: false, error: dojoErr.message });
    }
    if (dojoResults.length === 0) {
      return res.status(403).json({ success: false, error: 'Mitglied nicht gefunden oder kein Zugriff' });
    }

  // Zähle Rechnungen — dojo-spezifisch für normale Dojos, global für Super-Admin
  let checkQuery, checkParams;
  if (secureDojoId) {
    checkQuery = `
      SELECT COUNT(*) AS count
      FROM rechnungen r
      LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      WHERE YEAR(r.datum) = ? AND (m.dojo_id = ? OR (r.mitglied_id IS NULL AND r.dojo_id = ?))
    `;
    checkParams = [jahr, secureDojoId, secureDojoId];
  } else {
    checkQuery = `
      SELECT
        (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
        (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
      AS count
    `;
    checkParams = [jahr, jahr];
  }

  db.query(checkQuery, checkParams, (checkErr, checkResults) => {
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
  }); // checkQuery
  }); // dojoCheckQuery
});

// PUT /:id - Rechnung aktualisieren
router.put('/:id', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const { id } = req.params;
  const { status, beschreibung, notizen, bezahlt_am, zahlungsart, betrag, mwst_satz } = req.body;

  // Betrag-Felder neu berechnen wenn betrag übergeben
  let betragFields = '';
  const betragParams = [];
  if (betrag !== undefined && betrag !== null && betrag !== '') {
    const bruttoNeu = parseFloat(betrag);
    const mwstSatzNeu = parseFloat(mwst_satz || 19);
    const nettoNeu = bruttoNeu / (1 + mwstSatzNeu / 100);
    const mwstNeu = bruttoNeu - nettoNeu;
    betragFields = ', betrag = ?, brutto_betrag = ?, netto_betrag = ?, mwst_betrag = ?';
    betragParams.push(bruttoNeu, bruttoNeu, nettoNeu, mwstNeu);
  }

  let updateQuery;
  let updateParams;

  if (secureDojoId) {
    // Eigene Rechnung: über Mitglieder ODER Extern-Rechnung mit dojo_id
    updateQuery = `
      UPDATE rechnungen
      SET status = ?, beschreibung = ?, notizen = ?, bezahlt_am = ?, zahlungsart = ?${betragFields}
      WHERE rechnung_id = ?
        AND (mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)
             OR (mitglied_id IS NULL AND dojo_id = ?))
    `;
    updateParams = [status, beschreibung, notizen, bezahlt_am, zahlungsart, ...betragParams, id, secureDojoId, secureDojoId];
  } else {
    updateQuery = `
      UPDATE rechnungen
      SET status = ?, beschreibung = ?, notizen = ?, bezahlt_am = ?, zahlungsart = ?${betragFields}
      WHERE rechnung_id = ?
    `;
    updateParams = [status, beschreibung, notizen, bezahlt_am, zahlungsart, ...betragParams, id];
  }

  db.query(updateQuery, updateParams, (err, result) => {
    if (err) {
      logger.error('Fehler beim Aktualisieren der Rechnung:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden oder kein Zugriff' });
    }

    // Wenn Rechnung auf bezahlt gesetzt: verknüpften Beitrag ebenfalls als bezahlt markieren
    if (status === 'bezahlt') {
      db.query(
        `UPDATE beitraege SET bezahlt = 1, zahlungsart = COALESCE(?, zahlungsart) WHERE rechnung_id = ? AND bezahlt = 0`,
        [zahlungsart || null, id],
        (bErr) => {
          if (bErr) logger.error('Fehler beim Sync beitrag.bezahlt nach rechnung.bezahlt:', { error: bErr.message });
        }
      );
    }

    res.json({ success: true, message: 'Rechnung aktualisiert' });
  });
});

// PUT /:id/archivieren - Rechnung archivieren
router.put('/:id/archivieren', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const { id } = req.params;
  const { archiviert } = req.body;

  let query;
  let params;

  if (secureDojoId) {
    query = `
      UPDATE rechnungen SET archiviert = ?
      WHERE rechnung_id = ?
        AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)
    `;
    params = [archiviert ? 1 : 0, id, secureDojoId];
  } else {
    query = `UPDATE rechnungen SET archiviert = ? WHERE rechnung_id = ?`;
    params = [archiviert ? 1 : 0, id];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Archivieren:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden oder kein Zugriff' });
    }

    res.json({ success: true, message: archiviert ? 'Rechnung archiviert' : 'Archivierung aufgehoben' });
  });
});

// DELETE /:id - Rechnung löschen
router.delete('/:id', (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token
  const secureDojoId = getSecureDojoId(req);
  const { id } = req.params;

  let query;
  let params;

  if (secureDojoId) {
    query = `
      DELETE FROM rechnungen
      WHERE rechnung_id = ?
        AND mitglied_id IN (SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?)
    `;
    params = [id, secureDojoId];
  } else {
    query = `DELETE FROM rechnungen WHERE rechnung_id = ?`;
    params = [id];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      logger.error('Fehler beim Löschen der Rechnung:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Rechnung nicht gefunden oder kein Zugriff' });
    }

    res.json({ success: true, message: 'Rechnung gelöscht' });
  });
});

module.exports = router;
