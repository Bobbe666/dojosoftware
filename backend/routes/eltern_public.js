const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = db.promise();

// GET /api/public/eltern?token=xxx — Eltern-Portal ohne Auth
router.get('/', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token erforderlich' });

  try {
    // Zugang validieren
    const [zugaenge] = await pool.query(
      'SELECT * FROM eltern_zugang WHERE token = ? AND aktiv = 1', [token]
    );
    if (!zugaenge.length) {
      return res.status(403).json({ error: 'Ungültiger oder inaktiver Zugangslink' });
    }
    const zugang = zugaenge[0];

    // Letzten Login aktualisieren
    await pool.query('UPDATE eltern_zugang SET letzter_login = NOW() WHERE id = ?', [zugang.id]);

    // Kind-Daten laden (eingeschränkte Felder)
    const [mitglieder] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum,
              d.dojoname,
              GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stile,
              GROUP_CONCAT(DISTINCT g.name ORDER BY s.name SEPARATOR ', ') AS graduierungen
       FROM mitglieder m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
       LEFT JOIN stile s ON ms.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON ms.graduierung_id = g.graduierung_id
       WHERE m.mitglied_id = ?
       GROUP BY m.mitglied_id`, [zugang.mitglied_id]
    );
    if (!mitglieder.length) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    // Anstehende Prüfungen
    const [pruefungen] = await pool.query(
      `SELECT p.pruefungsdatum, p.status, s.name AS stil, g.name AS ziel_graduierung
       FROM pruefungen p
       JOIN stile s ON p.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
       WHERE p.mitglied_id = ? AND p.pruefungsdatum >= CURDATE()
       ORDER BY p.pruefungsdatum ASC LIMIT 5`, [zugang.mitglied_id]
    );

    // Anwesenheit (letzte 30 Tage)
    const [anwesenheit] = await pool.query(
      `SELECT COUNT(*) AS anzahl FROM anwesenheit
       WHERE mitglied_id = ? AND datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [zugang.mitglied_id]
    );

    res.json({
      success: true,
      eltern_name: zugang.eltern_name,
      kind: mitglieder[0],
      pruefungen,
      anwesenheit_30_tage: anwesenheit[0]?.anzahl || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Daten', detail: err.message });
  }
});

module.exports = router;
