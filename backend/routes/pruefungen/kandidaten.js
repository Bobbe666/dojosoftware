/**
 * Pruefungen Kandidaten Routes
 * Prüfungskandidaten-Verwaltung
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /kandidaten - Ermittelt alle Prüfungskandidaten
router.get('/kandidaten', (req, res) => {
  const { dojo_id, stil_id } = req.query;
  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE m.dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }
  if (stil_id) {
    whereClause += (whereClause ? ' AND' : 'WHERE') + ' msd.stil_id = ?';
    queryParams.push(parseInt(stil_id));
  }

  const query = `
    SELECT m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.email, m.dojo_id,
      s.stil_id, s.name as stil_name, msd.current_graduierung_id,
      g_current.name as aktuelle_graduierung, g_current.farbe_hex as aktuelle_farbe, g_current.reihenfolge as aktuelle_reihenfolge,
      g_next.graduierung_id as naechste_graduierung_id, g_next.name as naechste_graduierung, g_next.farbe_hex as naechste_farbe,
      g_next.trainingsstunden_min as benoetigte_stunden, g_next.mindestzeit_monate as benoetigte_monate,
      msd.letzte_pruefung,
      COALESCE((SELECT COUNT(*) FROM anwesenheit a WHERE a.mitglied_id = m.mitglied_id AND a.anwesend = 1 AND (msd.letzte_pruefung IS NULL OR a.datum > msd.letzte_pruefung)), 0) as absolvierte_stunden,
      CASE WHEN msd.letzte_pruefung IS NULL THEN TIMESTAMPDIFF(MONTH, m.eintrittsdatum, CURDATE()) ELSE TIMESTAMPDIFF(MONTH, msd.letzte_pruefung, CURDATE()) END as monate_seit_letzter_pruefung,
      CASE WHEN g_next.graduierung_id IS NULL THEN 0
        WHEN (COALESCE((SELECT COUNT(*) FROM anwesenheit a WHERE a.mitglied_id = m.mitglied_id AND a.anwesend = 1 AND (msd.letzte_pruefung IS NULL OR a.datum > msd.letzte_pruefung)), 0) >= g_next.trainingsstunden_min
          AND CASE WHEN msd.letzte_pruefung IS NULL THEN TIMESTAMPDIFF(MONTH, m.eintrittsdatum, CURDATE()) ELSE TIMESTAMPDIFF(MONTH, msd.letzte_pruefung, CURDATE()) END >= g_next.mindestzeit_monate) THEN 1
        ELSE 0 END as berechtigt,
      (SELECT COUNT(*) FROM pruefungen p WHERE p.mitglied_id = m.mitglied_id AND p.stil_id = s.stil_id AND p.graduierung_nachher_id = g_next.graduierung_id AND p.status = 'geplant') as bereits_zugelassen,
      (SELECT p.pruefung_id FROM pruefungen p WHERE p.mitglied_id = m.mitglied_id AND p.stil_id = s.stil_id AND p.graduierung_nachher_id = g_next.graduierung_id AND p.status = 'geplant' LIMIT 1) as pruefung_id
    FROM mitglieder m
    INNER JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
    INNER JOIN stile s ON msd.stil_id = s.stil_id
    LEFT JOIN graduierungen g_current ON msd.current_graduierung_id = g_current.graduierung_id
    LEFT JOIN graduierungen g_next ON (g_next.stil_id = s.stil_id AND g_next.aktiv = 1 AND g_next.reihenfolge = (SELECT MIN(g2.reihenfolge) FROM graduierungen g2 WHERE g2.stil_id = s.stil_id AND g2.aktiv = 1 AND (g_current.reihenfolge IS NULL OR g2.reihenfolge > g_current.reihenfolge)))
    ${whereClause}
    AND m.aktiv = 1 AND g_next.graduierung_id IS NOT NULL
    ORDER BY berechtigt DESC, s.name ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Ermitteln der Prüfungskandidaten:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Laden der Prüfungskandidaten', details: err.message });
    }

    const kandidaten = results.map(row => ({
      ...row,
      berechtigt: row.berechtigt === 1,
      bereits_zugelassen: row.bereits_zugelassen > 0,
      fortschritt_prozent: row.benoetigte_stunden > 0 ? Math.min(100, Math.round((row.absolvierte_stunden / row.benoetigte_stunden) * 100)) : 0
    }));

    res.json({ success: true, count: kandidaten.length, berechtigt_count: kandidaten.filter(k => k.berechtigt).length, kandidaten });
  });
});

// POST /kandidaten/:mitglied_id/zulassen - Mitglied für Prüfung zulassen
router.post('/kandidaten/:mitglied_id/zulassen', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const { stil_id, graduierung_nachher_id, pruefungsdatum, pruefungsort, pruefungsgebuehr, anmeldefrist, gurtlaenge, bemerkungen, teilnahmebedingungen, dojo_id, pruefungszeit = '10:00' } = req.body;

  if (!mitglied_id || !stil_id || !graduierung_nachher_id || !dojo_id) {
    return res.status(400).json({ error: 'Fehlende erforderliche Felder', required: ['mitglied_id', 'stil_id', 'graduierung_nachher_id', 'dojo_id'] });
  }

  db.query('SELECT id FROM dojo WHERE id = ?', [dojo_id], (dojoErr, dojoResults) => {
    if (dojoErr) return res.status(500).json({ error: 'Fehler beim Prüfen des Dojos', details: dojoErr.message });
    if (dojoResults.length === 0) return res.status(400).json({ error: `Dojo mit ID ${dojo_id} existiert nicht` });

    db.query('SELECT current_graduierung_id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?', [mitglied_id, stil_id], (gradErr, gradResults) => {
      if (gradErr) return res.status(500).json({ error: 'Fehler beim Abrufen der aktuellen Graduierung', details: gradErr.message });

      const graduierung_vorher_id = gradResults.length > 0 ? gradResults[0].current_graduierung_id : null;
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      const finalPruefungsdatum = pruefungsdatum || defaultDate.toISOString().split('T')[0];

      const insertQuery = `
        INSERT INTO pruefungen (mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id, pruefungsdatum, pruefungszeit, pruefungsort, pruefungsgebuehr, anmeldefrist, gurtlaenge, bemerkungen, teilnahmebedingungen, status, bestanden, erstellt_am, aktualisiert_am)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'geplant', FALSE, NOW(), NOW())
      `;

      db.query(insertQuery, [mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id, finalPruefungsdatum, pruefungszeit, pruefungsort || null, pruefungsgebuehr || null, anmeldefrist || null, gurtlaenge || null, bemerkungen || null, teilnahmebedingungen || null], (insertErr, result) => {
        if (insertErr) return res.status(500).json({ error: 'Fehler beim Zulassen zur Prüfung', details: insertErr.message });

        // Optional: Benachrichtigung
        db.query(`INSERT INTO notifications (recipient_type, recipient_id, title, message, notification_type, priority, action_url, created_at) VALUES ('mitglied', ?, 'Prüfungszulassung', 'Sie wurden für eine Gürtelprüfung zugelassen!', 'pruefung', 'high', '/member/pruefungen', NOW())`, [mitglied_id], () => {});

        res.status(201).json({ success: true, message: 'Mitglied erfolgreich zur Prüfung zugelassen', pruefung_id: result.insertId, mitglied_id });
      });
    });
  });
});

// DELETE /kandidaten/:mitglied_id/zulassung/:pruefung_id - Zulassung widerrufen
router.delete('/kandidaten/:mitglied_id/zulassung/:pruefung_id', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const pruefung_id = parseInt(req.params.pruefung_id);

  db.query("DELETE FROM pruefungen WHERE pruefung_id = ? AND mitglied_id = ? AND status = 'geplant'", [pruefung_id, mitglied_id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Fehler beim Widerrufen der Zulassung', details: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden oder bereits durchgeführt' });
    res.json({ success: true, message: 'Zulassung erfolgreich widerrufen' });
  });
});

// POST /:pruefung_id/teilnahme-bestaetigen - Teilnahme bestätigen
router.post('/:pruefung_id/teilnahme-bestaetigen', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  const { mitglied_id } = req.body;

  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  if (!mitglied_id) return res.status(400).json({ error: 'Mitglied-ID erforderlich' });

  db.query('SELECT pruefung_id, mitglied_id, status, teilnahme_bestaetigt FROM pruefungen WHERE pruefung_id = ? AND mitglied_id = ?', [pruefung_id, mitglied_id], (checkErr, checkResults) => {
    if (checkErr) return res.status(500).json({ error: 'Fehler beim Prüfen der Prüfung', details: checkErr.message });
    if (checkResults.length === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });

    const pruefung = checkResults[0];
    if (pruefung.status !== 'geplant') return res.status(400).json({ error: 'Prüfung ist nicht im Status "geplant"' });
    if (pruefung.teilnahme_bestaetigt) return res.status(400).json({ error: 'Teilnahme wurde bereits bestätigt' });

    db.query('UPDATE pruefungen SET teilnahme_bestaetigt = TRUE, teilnahme_bestaetigt_am = NOW(), aktualisiert_am = NOW() WHERE pruefung_id = ?', [pruefung_id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Fehler beim Bestätigen der Teilnahme', details: updateErr.message });
      res.json({ success: true, message: 'Teilnahme erfolgreich bestätigt', pruefung_id, teilnahme_bestaetigt_am: new Date() });
    });
  });
});

module.exports = router;
