/**
 * Stile Statistiken Routes
 * Statistiken, Analytics und Auswertungen
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();

// GET /:id/statistiken - Erweiterte Stil-Statistiken
router.get('/:id/statistiken', (req, res) => {
  const stilId = parseInt(req.params.id);
  if (!stilId || isNaN(stilId)) return res.status(400).json({ error: 'Ungültige Stil-ID' });

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Datenbankverbindung fehlgeschlagen', details: err.message });

    const queries = {
      graduierung: `
        SELECT g.graduierung_id, g.name as graduierung, g.farbe_hex, g.farbe_sekundaer, g.kategorie, g.dan_grad, g.reihenfolge,
          COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
        FROM graduierungen g
        LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
        LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
        WHERE g.stil_id = ? AND g.aktiv = 1
        GROUP BY g.graduierung_id ORDER BY g.reihenfolge ASC
      `,
      kategorie: `
        SELECT g.kategorie, COUNT(DISTINCT g.graduierung_id) as anzahl_graduierungen, COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder,
          AVG(g.trainingsstunden_min) as avg_trainingsstunden, AVG(g.mindestzeit_monate) as avg_mindestzeit
        FROM graduierungen g
        LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
        LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
        WHERE g.stil_id = ? AND g.aktiv = 1 GROUP BY g.kategorie
        ORDER BY CASE g.kategorie WHEN 'grundstufe' THEN 1 WHEN 'mittelstufe' THEN 2 WHEN 'oberstufe' THEN 3 WHEN 'dan' THEN 4 WHEN 'meister' THEN 5 ELSE 6 END
      `,
      alter: `
        SELECT CASE
          WHEN YEAR(CURDATE()) - YEAR(m.geburtsdatum) < 18 THEN 'Unter 18'
          WHEN YEAR(CURDATE()) - YEAR(m.geburtsdatum) BETWEEN 18 AND 30 THEN '18-30'
          WHEN YEAR(CURDATE()) - YEAR(m.geburtsdatum) BETWEEN 31 AND 50 THEN '31-50'
          ELSE 'Über 50' END as altersgruppe, COUNT(DISTINCT m.mitglied_id) as anzahl
        FROM mitglied_stil_data msd JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
        WHERE msd.stil_id = ? AND m.aktiv = 1 AND m.geburtsdatum IS NOT NULL GROUP BY altersgruppe
        ORDER BY CASE altersgruppe WHEN 'Unter 18' THEN 1 WHEN '18-30' THEN 2 WHEN '31-50' THEN 3 ELSE 4 END
      `,
      geschlecht: `
        SELECT m.geschlecht, COUNT(DISTINCT m.mitglied_id) as anzahl
        FROM mitglied_stil_data msd JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
        WHERE msd.stil_id = ? AND m.aktiv = 1 AND m.geschlecht IS NOT NULL GROUP BY m.geschlecht ORDER BY m.geschlecht
      `,
      punkte: `
        SELECT g_nachher.name as graduierung_name, g_nachher.farbe_hex as graduierung_farbe, g_nachher.reihenfolge,
          COUNT(p.pruefung_id) as anzahl_pruefungen, AVG(p.punktzahl) as durchschnitt_punkte,
          MIN(p.punktzahl) as min_punkte, MAX(p.punktzahl) as max_punkte, AVG(p.max_punktzahl) as durchschnitt_max_punkte,
          SUM(CASE WHEN p.bestanden = 1 THEN 1 ELSE 0 END) as bestanden_anzahl,
          SUM(CASE WHEN p.bestanden = 0 AND p.status IN ('bestanden', 'nicht_bestanden') THEN 1 ELSE 0 END) as nicht_bestanden_anzahl
        FROM pruefungen p JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
        WHERE g_nachher.stil_id = ? AND p.status IN ('bestanden', 'nicht_bestanden') AND p.punktzahl IS NOT NULL
        GROUP BY g_nachher.graduierung_id ORDER BY g_nachher.reihenfolge ASC
      `,
      hochstufungen: `
        SELECT DATE_FORMAT(p.pruefungsdatum, '%Y-%m') as monat, DATE_FORMAT(p.pruefungsdatum, '%b %Y') as monat_label,
          COUNT(p.pruefung_id) as anzahl_hochstufungen, g_nachher.name as ziel_graduierung, g_nachher.farbe_hex as ziel_farbe
        FROM pruefungen p JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
        WHERE g_nachher.stil_id = ? AND p.bestanden = 1 AND p.pruefungsdatum >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY monat, monat_label, g_nachher.graduierung_id ORDER BY monat DESC, g_nachher.reihenfolge ASC
      `,
      letzteHochstufungen: `
        SELECT p.pruefung_id, p.pruefungsdatum, p.punktzahl, p.max_punktzahl, m.vorname, m.nachname,
          g_vorher.name as von_graduierung, g_vorher.farbe_hex as von_farbe,
          g_nachher.name as zu_graduierung, g_nachher.farbe_hex as zu_farbe
        FROM pruefungen p JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
        LEFT JOIN graduierungen g_vorher ON p.graduierung_vorher_id = g_vorher.graduierung_id
        JOIN graduierungen g_nachher ON p.graduierung_nachher_id = g_nachher.graduierung_id
        WHERE g_nachher.stil_id = ? AND p.bestanden = 1 AND p.pruefungsdatum >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        ORDER BY p.pruefungsdatum DESC LIMIT 20
      `
    };

    Promise.all([
      new Promise((resolve, reject) => connection.query(queries.graduierung, [stilId], (err, r) => err ? reject(err) : resolve(r))),
      new Promise((resolve, reject) => connection.query(queries.kategorie, [stilId], (err, r) => err ? reject(err) : resolve(r))),
      new Promise((resolve, reject) => connection.query(queries.alter, [stilId], (err, r) => err ? reject(err) : resolve(r))),
      new Promise((resolve, reject) => connection.query(queries.geschlecht, [stilId], (err, r) => err ? reject(err) : resolve(r))),
      new Promise((resolve, reject) => connection.query(queries.punkte, [stilId], (err, r) => err ? reject(err) : resolve(r))),
      new Promise((resolve, reject) => connection.query(queries.hochstufungen, [stilId], (err, r) => err ? reject(err) : resolve(r))),
      new Promise((resolve, reject) => connection.query(queries.letzteHochstufungen, [stilId], (err, r) => err ? reject(err) : resolve(r)))
    ]).then(([graduierungStats, kategorieStats, altersStats, geschlechtStats, punkteStats, hochstufungenStats, letzteHochstufungen]) => {
      connection.release();

      const gesamtPunkteStats = punkteStats.length > 0 ? {
        durchschnitt: punkteStats.reduce((sum, p) => sum + (parseFloat(p.durchschnitt_punkte) || 0), 0) / punkteStats.filter(p => p.durchschnitt_punkte).length || 0,
        gesamt_pruefungen: punkteStats.reduce((sum, p) => sum + parseInt(p.anzahl_pruefungen), 0),
        gesamt_bestanden: punkteStats.reduce((sum, p) => sum + parseInt(p.bestanden_anzahl), 0),
        gesamt_nicht_bestanden: punkteStats.reduce((sum, p) => sum + parseInt(p.nicht_bestanden_anzahl), 0)
      } : null;

      const hochstufungenProMonat = {};
      hochstufungenStats.forEach(h => {
        if (!hochstufungenProMonat[h.monat]) {
          hochstufungenProMonat[h.monat] = { monat: h.monat, monat_label: h.monat_label, anzahl: 0, details: [] };
        }
        hochstufungenProMonat[h.monat].anzahl += parseInt(h.anzahl_hochstufungen);
        hochstufungenProMonat[h.monat].details.push({ graduierung: h.ziel_graduierung, farbe: h.ziel_farbe, anzahl: parseInt(h.anzahl_hochstufungen) });
      });

      res.json({
        graduierungen: graduierungStats,
        kategorien: kategorieStats,
        altersgruppen: altersStats,
        geschlecht: geschlechtStats,
        pruefungsPunkte: { pro_graduierung: punkteStats, gesamt: gesamtPunkteStats },
        hochstufungen: {
          pro_monat: Object.values(hochstufungenProMonat),
          letzte: letzteHochstufungen,
          gesamt_12_monate: hochstufungenStats.reduce((sum, h) => sum + parseInt(h.anzahl_hochstufungen), 0)
        },
        summary: {
          total_graduierungen: graduierungStats.length,
          total_mitglieder: graduierungStats.reduce((sum, g) => sum + g.anzahl_mitglieder, 0),
          kategorien_count: kategorieStats.length
        }
      });
    }).catch(error => {
      connection.release();
      logger.error('Fehler bei Statistiken:', { error });
      res.status(500).json({ error: 'Fehler beim Erstellen der Statistiken', details: error.message });
    });
  });
});

// GET /kategorien/uebersicht - Kategorie-Übersicht für alle Stile
router.get('/kategorien/uebersicht', (req, res) => {
  const query = `
    SELECT s.stil_id, s.name as stil_name, g.kategorie,
      COUNT(DISTINCT g.graduierung_id) as anzahl_graduierungen, COUNT(DISTINCT msd.mitglied_id) as anzahl_mitglieder
    FROM stile s
    LEFT JOIN graduierungen g ON s.stil_id = g.stil_id AND g.aktiv = 1
    LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
    LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
    WHERE s.aktiv = 1 GROUP BY s.stil_id, s.name, g.kategorie
    ORDER BY s.name ASC, CASE g.kategorie WHEN 'grundstufe' THEN 1 WHEN 'mittelstufe' THEN 2 WHEN 'oberstufe' THEN 3 WHEN 'dan' THEN 4 WHEN 'meister' THEN 5 ELSE 6 END
  `;

  db.query(query, (error, results) => {
    if (error) return res.status(500).json({ error: 'Fehler beim Abrufen der Kategorie-Übersicht', details: error.message });
    res.json(results);
  });
});

// GET /auswertungen/guertel-uebersicht - Komplette Gürtel-Übersicht
router.get('/auswertungen/guertel-uebersicht', (req, res) => {
  const query = `
    SELECT s.stil_id, s.name as stil_name, g.graduierung_id, g.name as gurt_name, g.farbe_hex, g.farbe_sekundaer,
      g.kategorie, g.dan_grad, g.reihenfolge, m.mitglied_id, m.vorname, m.nachname, m.email,
      (SELECT COUNT(*) FROM anwesenheit_protokoll ap WHERE ap.mitglied_id = m.mitglied_id AND ap.status = 'anwesend' AND YEAR(ap.datum) = YEAR(CURDATE())) as anwesenheit_jahr,
      (SELECT COUNT(*) FROM anwesenheit_protokoll ap WHERE ap.mitglied_id = m.mitglied_id AND ap.status = 'anwesend' AND YEAR(ap.datum) = YEAR(CURDATE()) AND MONTH(ap.datum) = MONTH(CURDATE())) as anwesenheit_monat
    FROM stile s
    LEFT JOIN graduierungen g ON s.stil_id = g.stil_id AND g.aktiv = 1
    LEFT JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id AND msd.stil_id = g.stil_id
    LEFT JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id AND m.aktiv = 1
    WHERE s.aktiv = 1
    ORDER BY s.reihenfolge ASC, s.name ASC, g.reihenfolge ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, (error, results) => {
    if (error) return res.status(500).json({ error: 'Fehler beim Abrufen der Gürtel-Übersicht', details: error.message });

    const stileMap = new Map();
    results.forEach(row => {
      if (!stileMap.has(row.stil_id)) {
        stileMap.set(row.stil_id, { stil_id: row.stil_id, stil_name: row.stil_name, guertel: new Map() });
      }
      const stil = stileMap.get(row.stil_id);
      if (row.graduierung_id && !stil.guertel.has(row.graduierung_id)) {
        stil.guertel.set(row.graduierung_id, {
          graduierung_id: row.graduierung_id, gurt_name: row.gurt_name, farbe_hex: row.farbe_hex,
          farbe_sekundaer: row.farbe_sekundaer, kategorie: row.kategorie, dan_grad: row.dan_grad, reihenfolge: row.reihenfolge, mitglieder: []
        });
      }
      if (row.mitglied_id && row.graduierung_id) {
        stil.guertel.get(row.graduierung_id).mitglieder.push({
          mitglied_id: row.mitglied_id, vorname: row.vorname, nachname: row.nachname, email: row.email,
          anwesenheit_jahr: row.anwesenheit_jahr || 0, anwesenheit_monat: row.anwesenheit_monat || 0
        });
      }
    });

    const stile = Array.from(stileMap.values()).map(stil => ({ ...stil, guertel: Array.from(stil.guertel.values()) }));
    res.json({
      success: true, stile,
      summary: { total_stile: stile.length, total_guertel: stile.reduce((sum, s) => sum + s.guertel.length, 0), total_mitglieder: results.filter(r => r.mitglied_id).length }
    });
  });
});

module.exports = router;
