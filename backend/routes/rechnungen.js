const express = require('express');
const router = express.Router();
const db = require('../db');
const { createRechnungForBeitrag } = require('../utils/rechnungAutomation');

// ===== RECHNUNGEN ÜBERSICHT =====
// GET /api/rechnungen - Alle Rechnungen mit Filter
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
      console.error('Fehler beim Laden der Rechnungen:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results });
  });
});

// GET /api/rechnungen/statistiken - Statistiken für Dashboard
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
      console.error('Fehler beim Laden der Statistiken:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, data: results[0] });
  });
});

// GET /api/rechnungen/:id - Einzelne Rechnung mit Details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const rechnungQuery = `
    SELECT
      r.*,
      CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
      m.email,
      m.telefon,
      m.adresse,
      m.plz,
      m.ort
    FROM rechnungen r
    JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
    WHERE r.rechnung_id = ?
  `;

  db.query(rechnungQuery, [id], (err, rechnungResults) => {
    if (err) {
      console.error('Fehler beim Laden der Rechnung:', err);
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
        console.error('Fehler beim Laden der Positionen:', posErr);
        return res.status(500).json({ success: false, error: posErr.message });
      }

      // Lade Zahlungen
      const zahlungenQuery = `SELECT * FROM zahlungen WHERE rechnung_id = ? ORDER BY zahlungsdatum DESC`;

      db.query(zahlungenQuery, [id], (zahlErr, zahlungen) => {
        if (zahlErr) {
          console.error('Fehler beim Laden der Zahlungen:', zahlErr);
          return res.status(500).json({ success: false, error: zahlErr.message });
        }

        rechnung.positionen = positionen;
        rechnung.zahlungen = zahlungen;

        res.json({ success: true, data: rechnung });
      });
    });
  });
});

// POST /api/rechnungen - Neue Rechnung erstellen
router.post('/', (req, res) => {
  const {
    mitglied_id,
    datum,
    faelligkeitsdatum,
    art,
    beschreibung,
    notizen,
    positionen,
    mwst_satz
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

  // Generiere Rechnungsnummer
  const Jahr = new Date().getFullYear();
  const checkQuery = `SELECT COUNT(*) as count FROM rechnungen WHERE YEAR(datum) = ?`;

  db.query(checkQuery, [Jahr], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('Fehler beim Prüfen der Rechnungsnummer:', checkErr);
      return res.status(500).json({ success: false, error: checkErr.message });
    }

    const count = checkResults[0].count + 1;
    const rechnungsnummer = `RE-${Jahr}-${String(count).padStart(5, '0')}`;

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
        console.error('Fehler beim Erstellen der Rechnung:', insertErr);
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
        .then(() => {
          res.json({
            success: true,
            message: 'Rechnung erfolgreich erstellt',
            rechnung_id: rechnung_id,
            rechnungsnummer: rechnungsnummer
          });
        })
        .catch(posErr => {
          console.error('Fehler beim Einfügen der Positionen:', posErr);
          res.status(500).json({ success: false, error: posErr.message });
        });
    });
  });
});

// PUT /api/rechnungen/:id - Rechnung aktualisieren
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
      console.error('Fehler beim Aktualisieren der Rechnung:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: 'Rechnung aktualisiert' });
  });
});

// POST /api/rechnungen/:id/zahlung - Zahlung erfassen
router.post('/:id/zahlung', (req, res) => {
  const { id } = req.params;
  const { betrag, zahlungsdatum, zahlungsart, referenz, notizen } = req.body;

  if (!betrag || !zahlungsdatum || !zahlungsart) {
    return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
  }

  // Zahlung einfügen
  const insertQuery = `
    INSERT INTO zahlungen (rechnung_id, betrag, zahlungsdatum, zahlungsart, referenz, notizen)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(insertQuery, [id, betrag, zahlungsdatum, zahlungsart, referenz, notizen], (insertErr) => {
    if (insertErr) {
      console.error('Fehler beim Erfassen der Zahlung:', insertErr);
      return res.status(500).json({ success: false, error: insertErr.message });
    }

    // Prüfe Zahlungsstatus
    const checkQuery = `
      SELECT
        r.betrag as rechnung_betrag,
        COALESCE(SUM(z.betrag), 0) as gezahlt
      FROM rechnungen r
      LEFT JOIN zahlungen z ON r.rechnung_id = z.rechnung_id
      WHERE r.rechnung_id = ?
      GROUP BY r.rechnung_id, r.betrag
    `;

    db.query(checkQuery, [id], (checkErr, checkResults) => {
      if (checkErr) {
        console.error('Fehler beim Prüfen des Status:', checkErr);
        return res.status(500).json({ success: false, error: checkErr.message });
      }

      const { rechnung_betrag, gezahlt } = checkResults[0];
      let neuer_status = 'offen';
      let bezahlt_am = null;

      if (parseFloat(gezahlt) >= parseFloat(rechnung_betrag)) {
        neuer_status = 'bezahlt';
        bezahlt_am = zahlungsdatum;
      } else if (parseFloat(gezahlt) > 0) {
        neuer_status = 'teilweise_bezahlt';
      }

      // Update Status
      const updateQuery = `UPDATE rechnungen SET status = ?, bezahlt_am = ? WHERE rechnung_id = ?`;

      db.query(updateQuery, [neuer_status, bezahlt_am, id], (updateErr) => {
        if (updateErr) {
          console.error('Fehler beim Aktualisieren des Status:', updateErr);
          return res.status(500).json({ success: false, error: updateErr.message });
        }

        res.json({ success: true, message: 'Zahlung erfasst', status: neuer_status });
      });
    });
  });
});

// PUT /api/rechnungen/:id/archivieren - Rechnung archivieren
router.put('/:id/archivieren', (req, res) => {
  const { id } = req.params;
  const { archiviert } = req.body;

  const query = `UPDATE rechnungen SET archiviert = ? WHERE rechnung_id = ?`;

  db.query(query, [archiviert ? 1 : 0, id], (err) => {
    if (err) {
      console.error('Fehler beim Archivieren:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: archiviert ? 'Rechnung archiviert' : 'Archivierung aufgehoben' });
  });
});

// DELETE /api/rechnungen/:id - Rechnung löschen
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM rechnungen WHERE rechnung_id = ?`;

  db.query(query, [id], (err) => {
    if (err) {
      console.error('Fehler beim Löschen der Rechnung:', err);
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true, message: 'Rechnung gelöscht' });
  });
});

// ===== AUTOMATISCHE BEITRAGS-RECHNUNGEN =====
// POST /api/rechnungen/generate-monthly - Monatliche Rechnungen für alle 'invoice' Verträge erstellen
router.post('/generate-monthly', async (req, res) => {
  const { monat, jahr } = req.body;

  if (!monat || !jahr) {
    return res.status(400).json({ success: false, error: 'Monat und Jahr erforderlich' });
  }

  try {
    // Alle aktiven Verträge mit payment_method='invoice' laden
    const vertraegeQuery = `
      SELECT v.id, v.mitglied_id, v.payment_method
      FROM vertraege v
      WHERE v.status = 'aktiv'
        AND v.payment_method = 'invoice'
    `;

    db.query(vertraegeQuery, async (err, vertraege) => {
      if (err) {
        console.error('Fehler beim Laden der Verträge:', err);
        return res.status(500).json({ success: false, error: err.message });
      }

      const results = {
        success: 0,
        skipped: 0,
        errors: 0,
        rechnungen: []
      };

      // Für jeden Vertrag Rechnung erstellen
      for (const vertrag of vertraege) {
        try {
          const rechnungInfo = await createRechnungForBeitrag(
            vertrag.id,
            vertrag.mitglied_id,
            monat,
            jahr
          );

          if (rechnungInfo) {
            results.success++;
            results.rechnungen.push(rechnungInfo);
          } else {
            results.skipped++;
          }
        } catch (error) {
          console.error(`Fehler bei Vertrag #${vertrag.id}:`, error);
          results.errors++;
        }
      }

      res.json({
        success: true,
        message: `Rechnungserstellung abgeschlossen: ${results.success} erstellt, ${results.skipped} übersprungen, ${results.errors} Fehler`,
        data: results
      });
    });

  } catch (error) {
    console.error('Fehler bei monatlicher Rechnungserstellung:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
