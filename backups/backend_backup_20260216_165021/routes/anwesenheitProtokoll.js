// Backend/routes/anwesenheitProtokoll.js - Enhanced Protocol System
const express = require("express");
const logger = require('../utils/logger');
const router = express.Router();
const db = require("../db");

// POST: Anwesenheit speichern (mehrere Einträge) - Verbessert
router.post("/", (req, res) => {
  const eintraege = req.body;

  if (!Array.isArray(eintraege) || eintraege.length === 0) {
    return res.status(400).json({ error: "Keine Daten übermittelt." });
  }

  // Validierung der Einträge
  const invalidEntries = eintraege.filter(eintrag => 
    !eintrag.mitglied_id || !eintrag.stundenplan_id || !eintrag.datum
  );

  if (invalidEntries.length > 0) {
    return res.status(400).json({ 
      error: "Ungültige Einträge gefunden", 
      invalid_count: invalidEntries.length,
      required_fields: ["mitglied_id", "stundenplan_id", "datum"]
    });
  }

  const sql = `
    INSERT INTO anwesenheit_protokoll 
    (mitglied_id, stundenplan_id, datum, status, bemerkung, erstellt_am)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      bemerkung = VALUES(bemerkung),
      erstellt_am = CURRENT_TIMESTAMP
  `;

  const werte = eintraege.map((eintrag) => [
    eintrag.mitglied_id,
    eintrag.stundenplan_id,
    eintrag.datum,
    eintrag.status || "anwesend",
    eintrag.bemerkung || null,
    new Date()
  ]);

  db.query(sql, [werte], (err, result) => {
    if (err) {
      logger.error('Fehler beim Einfügen der Anwesenheitsprotokolle:', { error: err });
      return res.status(500).json({ 
        error: "Fehler beim Speichern der Anwesenheitsprotokolle",
        details: err.message 
      });
    }

    res.status(200).json({ 
      success: true,
      message: "Anwesenheitsprotokolle gespeichert", 
      inserted: result.affectedRows,
      entries_processed: eintraege.length
    });
  });
});

// GET: Anwesenheiten für Kursstunde + Datum abrufen - Verbessert
router.get("/", (req, res) => {
  const { stundenplan_id, datum, mitglied_id, status } = req.query;

  // Base Query
  let sql = `
    SELECT 
      ap.mitglied_id, 
      ap.stundenplan_id,
      ap.datum,
      ap.status, 
      ap.bemerkung,
      ap.erstellt_am,
      m.vorname,
      m.nachname,
      CONCAT(m.vorname, ' ', m.nachname) as full_name,
      m.gurtfarbe,
      k.gruppenname as kurs_name,
      CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as kurs_zeit
    FROM anwesenheit_protokoll ap
    JOIN mitglieder m ON ap.mitglied_id = m.mitglied_id
    JOIN stundenplan s ON ap.stundenplan_id = s.stundenplan_id
    LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
    WHERE 1=1
  `;

  const params = [];

  // Filter anwenden
  if (stundenplan_id) {
    sql += " AND ap.stundenplan_id = ?";
    params.push(stundenplan_id);
  }

  if (datum) {
    sql += " AND ap.datum = ?";
    params.push(datum);
  }

  if (mitglied_id) {
    sql += " AND ap.mitglied_id = ?";
    params.push(mitglied_id);
  }

  if (status) {
    sql += " AND ap.status = ?";
    params.push(status);
  }

  sql += " ORDER BY ap.datum DESC, s.uhrzeit_start, m.nachname, m.vorname";

  db.query(sql, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Anwesenheitsprotokolle:', { error: err });
      return res.status(500).json({ 
        error: "Fehler beim Abrufen der Anwesenheitsprotokolle",
        details: err.message 
      });
    }

    res.json({
      success: true,
      total: results.length,
      filters: { stundenplan_id, datum, mitglied_id, status },
      protocols: results
    });
  });
});

// 🆕 NEU: Detaillierte Statistiken für Kurs/Datum
router.get("/statistiken/:stundenplan_id/:datum", (req, res) => {
  const stundenplan_id = parseInt(req.params.stundenplan_id, 10);
  const datum = req.params.datum;

  if (isNaN(stundenplan_id)) {
    return res.status(400).json({ error: "Ungültige Stundenplan-ID" });
  }

  const sql = `
    SELECT 
      -- Basis-Statistiken
      COUNT(*) as total_eintraege,
      SUM(CASE WHEN ap.status = 'anwesend' THEN 1 ELSE 0 END) as anwesend_count,
      SUM(CASE WHEN ap.status = 'abwesend' THEN 1 ELSE 0 END) as abwesend_count,
      SUM(CASE WHEN ap.status = 'entschuldigt' THEN 1 ELSE 0 END) as entschuldigt_count,
      SUM(CASE WHEN ap.status = 'verspaetet' THEN 1 ELSE 0 END) as verspaetet_count,
      
      -- Check-in Vergleich
      (SELECT COUNT(*) FROM checkins c 
       WHERE c.stundenplan_id = ? AND DATE(c.checkin_time) = ?) as total_checkins,
      (SELECT COUNT(*) FROM checkins c 
       WHERE c.stundenplan_id = ? AND DATE(c.checkin_time) = ? AND c.status = 'active') as aktive_checkins,
      
      -- Kurs-Info
      k.gruppenname as kurs_name,
      CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as kurs_zeit,
      CONCAT(t.vorname, ' ', t.nachname) as trainer_name
      
    FROM anwesenheit_protokoll ap
    JOIN stundenplan s ON ap.stundenplan_id = s.stundenplan_id
    LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
    LEFT JOIN trainer t ON s.trainer_id = t.trainer_id
    WHERE ap.stundenplan_id = ? AND ap.datum = ?
    GROUP BY ap.stundenplan_id, ap.datum
  `;

  db.query(sql, [stundenplan_id, datum, stundenplan_id, datum, stundenplan_id, datum], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Statistiken:', { error: err });
      return res.status(500).json({ 
        error: "Fehler beim Abrufen der Statistiken",
        details: err.message 
      });
    }

    if (results.length === 0) {
      return res.json({
        success: true,
        stundenplan_id: stundenplan_id,
        datum: datum,
        message: "Keine Daten für diesen Kurs/Datum gefunden",
        stats: {
          total_eintraege: 0,
          anwesend_count: 0,
          abwesend_count: 0,
          entschuldigt_count: 0,
          verspaetet_count: 0,
          total_checkins: 0,
          aktive_checkins: 0
        }
      });
    }

    const stats = results[0];
    
    // Anwesenheitsquote berechnen
    const anwesenheitsquote = stats.total_eintraege > 0 
      ? Math.round((stats.anwesend_count / stats.total_eintraege) * 100) 
      : 0;

    // Check-in vs Protokoll Abweichung
    const protokoll_checkin_diff = stats.total_eintraege - stats.total_checkins;

    res.json({
      success: true,
      stundenplan_id: stundenplan_id,
      datum: datum,
      kurs_info: {
        name: stats.kurs_name,
        zeit: stats.kurs_zeit,
        trainer: stats.trainer_name
      },
      stats: {
        total_eintraege: stats.total_eintraege,
        anwesend_count: stats.anwesend_count,
        abwesend_count: stats.abwesend_count,
        entschuldigt_count: stats.entschuldigt_count,
        verspaetet_count: stats.verspaetet_count,
        anwesenheitsquote: anwesenheitsquote,
        total_checkins: stats.total_checkins,
        aktive_checkins: stats.aktive_checkins,
        protokoll_checkin_diff: protokoll_checkin_diff
      }
    });
  });
});

// NEU: Übersicht aller Anwesenheiten mit JOINs & erweiterten Filtern
router.get("/uebersicht", (req, res) => {
  const { kurs_id, datum_von, datum_bis, mitglied_id, trainer_id, status, limit = 100 } = req.query;

  const where = [];
  const values = [];

  // Filter aufbauen
  if (kurs_id) {
    where.push("k.kurs_id = ?");
    values.push(kurs_id);
  }

  if (mitglied_id) {
    where.push("m.mitglied_id = ?");
    values.push(mitglied_id);
  }

  if (trainer_id) {
    where.push("t.trainer_id = ?");
    values.push(trainer_id);
  }

  if (status) {
    where.push("ap.status = ?");
    values.push(status);
  }

  if (datum_von && datum_bis) {
    where.push("ap.datum BETWEEN ? AND ?");
    values.push(datum_von, datum_bis);
  } else if (datum_von) {
    where.push("ap.datum >= ?");
    values.push(datum_von);
  } else if (datum_bis) {
    where.push("ap.datum <= ?");
    values.push(datum_bis);
  }

  const whereSQL = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      ap.datum,
      ap.status,
      ap.bemerkung,
      ap.erstellt_am,
      m.mitglied_id,
      m.vorname,
      m.nachname,
      CONCAT(m.vorname, ' ', m.nachname) as full_name,
      m.gurtfarbe,
      sp.stundenplan_id,
      sp.uhrzeit_start,
      sp.uhrzeit_ende,
      sp.tag,
      CONCAT(TIME_FORMAT(sp.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(sp.uhrzeit_ende, '%H:%i')) as zeit,
      k.kurs_id,
      k.gruppenname as kursname,
      k.stil,
      t.trainer_id,
      CONCAT(t.vorname, ' ', t.nachname) as trainer_name,
      
      -- Check-in Vergleich
      (SELECT COUNT(*) FROM checkins c 
       WHERE c.mitglied_id = m.mitglied_id 
       AND c.stundenplan_id = sp.stundenplan_id 
       AND DATE(c.checkin_time) = ap.datum) as had_checkin
       
    FROM anwesenheit_protokoll ap
    JOIN mitglieder m ON ap.mitglied_id = m.mitglied_id
    JOIN stundenplan sp ON ap.stundenplan_id = sp.stundenplan_id
    LEFT JOIN kurse k ON sp.kurs_id = k.kurs_id
    LEFT JOIN trainer t ON sp.trainer_id = t.trainer_id
    ${whereSQL}
    ORDER BY ap.datum DESC, sp.uhrzeit_start, m.nachname, m.vorname
    LIMIT ?
  `;

  values.push(parseInt(limit));

  db.query(sql, values, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Anwesenheitsübersicht:', { error: err });
      return res.status(500).json({ 
        error: "Fehler beim Abrufen der Anwesenheitsübersicht",
        details: err.message 
      });
    }

    // Zusammenfassung berechnen
    const summary = {
      total_records: results.length,
      anwesend: results.filter(r => r.status === 'anwesend').length,
      abwesend: results.filter(r => r.status === 'abwesend').length,
      entschuldigt: results.filter(r => r.status === 'entschuldigt').length,
      verspaetet: results.filter(r => r.status === 'verspaetet').length,
      mit_checkin: results.filter(r => r.had_checkin > 0).length,
      ohne_checkin: results.filter(r => r.had_checkin === 0).length
    };

    res.json({
      success: true,
      filters: { kurs_id, datum_von, datum_bis, mitglied_id, trainer_id, status, limit },
      summary: summary,
      records: results
    });
  });
});

// 🆕 NEU: Anwesenheitstrend für Mitglied
router.get("/trend/:mitglied_id", (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id, 10);
  const { wochen = 8 } = req.query; // Standard: letzte 8 Wochen

  if (isNaN(mitglied_id)) {
    return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
  }

  const sql = `
    SELECT 
      DATE(ap.datum) as datum,
      WEEK(ap.datum) as kalenderwoche,
      YEAR(ap.datum) as jahr,
      COUNT(*) as total_stunden,
      SUM(CASE WHEN ap.status = 'anwesend' THEN 1 ELSE 0 END) as anwesend_stunden,
      SUM(CASE WHEN ap.status = 'abwesend' THEN 1 ELSE 0 END) as abwesend_stunden,
      SUM(CASE WHEN ap.status = 'entschuldigt' THEN 1 ELSE 0 END) as entschuldigt_stunden,
      SUM(CASE WHEN ap.status = 'verspaetet' THEN 1 ELSE 0 END) as verspaetet_stunden,
      ROUND(
        (SUM(CASE WHEN ap.status = 'anwesend' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1
      ) as anwesenheitsquote
    FROM anwesenheit_protokoll ap
    WHERE ap.mitglied_id = ?
      AND ap.datum >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
    GROUP BY WEEK(ap.datum), YEAR(ap.datum)
    ORDER BY jahr DESC, kalenderwoche DESC
  `;

  db.query(sql, [mitglied_id, wochen], (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Anwesenheitstrends:', { error: err });
      return res.status(500).json({ 
        error: "Fehler beim Abrufen des Anwesenheitstrends",
        details: err.message 
      });
    }

    // Gesamtstatistiken berechnen
    const total_stats = {
      total_stunden: results.reduce((sum, r) => sum + r.total_stunden, 0),
      anwesend_stunden: results.reduce((sum, r) => sum + r.anwesend_stunden, 0),
      abwesend_stunden: results.reduce((sum, r) => sum + r.abwesend_stunden, 0),
      entschuldigt_stunden: results.reduce((sum, r) => sum + r.entschuldigt_stunden, 0),
      verspaetet_stunden: results.reduce((sum, r) => sum + r.verspaetet_stunden, 0)
    };

    total_stats.gesamt_anwesenheitsquote = total_stats.total_stunden > 0 
      ? Math.round((total_stats.anwesend_stunden / total_stats.total_stunden) * 100 * 10) / 10
      : 0;

    res.json({
      success: true,
      mitglied_id: mitglied_id,
      zeitraum_wochen: wochen,
      total_stats: total_stats,
      weekly_data: results
    });
  });
});

// 🆕 NEU: Prüfungsvoraussetzungen für Mitglied
router.get("/pruefung/:mitglied_id", (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id, 10);
  const { monate = 6, min_stunden = 20, min_anwesenheit = 80 } = req.query;

  if (isNaN(mitglied_id)) {
    return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
  }

  const sql = `
    SELECT 
      m.mitglied_id,
      CONCAT(m.vorname, ' ', m.nachname) as full_name,
      m.gurtfarbe,
      m.eintrittsdatum,
      
      -- Stil-Informationen
      k.stil,
      k.kurs_id,
      
      -- Anwesenheitsstatistiken pro Stil
      COUNT(ap.mitglied_id) as total_stunden,
      SUM(CASE WHEN ap.status = 'anwesend' THEN 1 ELSE 0 END) as anwesend_stunden,
      SUM(CASE WHEN ap.status = 'abwesend' THEN 1 ELSE 0 END) as abwesend_stunden,
      SUM(CASE WHEN ap.status = 'entschuldigt' THEN 1 ELSE 0 END) as entschuldigt_stunden,
      
      ROUND(
        (SUM(CASE WHEN ap.status = 'anwesend' THEN 1 ELSE 0 END) / COUNT(ap.mitglied_id)) * 100, 1
      ) as anwesenheitsquote,
      
      -- Zeitraum
      MIN(ap.datum) as erste_stunde,
      MAX(ap.datum) as letzte_stunde,
      DATEDIFF(CURDATE(), MIN(ap.datum)) as tage_seit_beginn
      
    FROM mitglieder m
    LEFT JOIN anwesenheit_protokoll ap ON (
      m.mitglied_id = ap.mitglied_id 
      AND ap.datum >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    )
    LEFT JOIN stundenplan s ON ap.stundenplan_id = s.stundenplan_id
    LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
    WHERE m.mitglied_id = ?
    GROUP BY m.mitglied_id, k.stil, k.kurs_id
  `;

  const params = [monate, mitglied_id];

  db.query(sql, params, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Prüfungsvoraussetzungen:', { error: err });
      return res.status(500).json({ 
        error: "Fehler beim Abrufen der Prüfungsvoraussetzungen",
        details: err.message 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    // Gruppiere Ergebnisse nach Stilen
    const stileDaten = {};
    let mitgliedInfo = null;

    results.forEach(row => {
      if (!mitgliedInfo) {
        mitgliedInfo = {
          id: row.mitglied_id,
          name: row.full_name,
          gurtfarbe: row.gurtfarbe,
          eintrittsdatum: row.eintrittsdatum
        };
      }

      if (row.stil) {
        stileDaten[row.stil] = {
          stil: row.stil,
          kurs_id: row.kurs_id,
          total_stunden: row.total_stunden,
          anwesend_stunden: row.anwesend_stunden,
          abwesend_stunden: row.abwesend_stunden,
          entschuldigt_stunden: row.entschuldigt_stunden,
          anwesenheitsquote: row.anwesenheitsquote,
          erste_stunde: row.erste_stunde,
          letzte_stunde: row.letzte_stunde,
          tage_seit_beginn: row.tage_seit_beginn
        };
      }
    });

    // Prüfungsvoraussetzungen bewerten (für alle Stile zusammen)
    const totalStats = {
      total_stunden: results.reduce((sum, r) => sum + (r.total_stunden || 0), 0),
      anwesend_stunden: results.reduce((sum, r) => sum + (r.anwesend_stunden || 0), 0),
      abwesend_stunden: results.reduce((sum, r) => sum + (r.abwesend_stunden || 0), 0),
      entschuldigt_stunden: results.reduce((sum, r) => sum + (r.entschuldigt_stunden || 0), 0)
    };

    totalStats.anwesenheitsquote = totalStats.total_stunden > 0 
      ? Math.round((totalStats.anwesend_stunden / totalStats.total_stunden) * 100 * 10) / 10
      : 0;

    const requirements = {
      min_stunden: parseInt(min_stunden),
      min_anwesenheit: parseFloat(min_anwesenheit),
      zeitraum_monate: parseInt(monate)
    };

    const evaluation = {
      stunden_erfuellt: totalStats.anwesend_stunden >= requirements.min_stunden,
      anwesenheit_erfuellt: totalStats.anwesenheitsquote >= requirements.min_anwesenheit,
      zeitraum_erfuellt: results.length > 0 && results[0].tage_seit_beginn >= (requirements.zeitraum_monate * 30)
    };

    evaluation.alle_erfuellt = evaluation.stunden_erfuellt && 
                              evaluation.anwesenheit_erfuellt && 
                              evaluation.zeitraum_erfuellt;

    res.json({
      success: true,
      mitglied: mitgliedInfo,
      zeitraum: {
        monate: monate,
        erste_stunde: results.length > 0 ? results[0].erste_stunde : null,
        letzte_stunde: results.length > 0 ? results[0].letzte_stunde : null,
        tage_seit_beginn: results.length > 0 ? results[0].tage_seit_beginn : 0
      },
      stile: stileDaten, // 🆕 NEU: Stil-spezifische Daten
      statistiken: totalStats,
      requirements: requirements,
      evaluation: evaluation
    });
  });
});

module.exports = router;