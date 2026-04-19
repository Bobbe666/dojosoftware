/**
 * Prüfungen - Stats Routes
 * Prüfungsstatistiken und Auswertungen
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { ERROR_MESSAGES, HTTP_STATUS } = require('../../utils/constants');
const { getSecureDojoId } = require('../../utils/dojo-filter-helper');

router.get('/statistiken', (req, res) => {
  const secureDojoId = getSecureDojoId(req);

  // Effektive dojo_id: Bei normalem Admin immer eigenes Dojo, Super-Admin darf filtern
  const effectiveDojoId = secureDojoId !== null
    ? secureDojoId
    : (req.query.dojo_id && req.query.dojo_id !== 'all' ? parseInt(req.query.dojo_id) : null);

  // dojo_ids (Plural, kommasepariert) für Multi-Dojo Super-Admin
  const dojo_ids_param = req.query.dojo_ids;
  const effectiveDojoIds = (!effectiveDojoId && dojo_ids_param)
    ? dojo_ids_param.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : null;

  const { jahr } = req.query;
  let whereConditions = [];
  let queryParams = [];

  if (effectiveDojoId) {
    whereConditions.push('dojo_id = ?');
    queryParams.push(effectiveDojoId);
  } else if (effectiveDojoIds && effectiveDojoIds.length > 0) {
    whereConditions.push(`dojo_id IN (${effectiveDojoIds.map(() => '?').join(',')})`);
    queryParams.push(...effectiveDojoIds);
  } else {
    // Super-Admin ohne Dojo-Filter: nur verwaltete Dojos (ohne eigene Admins)
    whereConditions.push(`dojo_id NOT IN (SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin'))`);
  }

  if (jahr) {
    whereConditions.push('YEAR(pruefungsdatum) = ?');
    queryParams.push(parseInt(jahr));
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  let gurtConditions = ['m.aktiv = 1'];
  let gurtParams = [];
  if (effectiveDojoId) {
    gurtConditions.push('m.dojo_id = ?');
    gurtParams.push(effectiveDojoId);
  } else if (effectiveDojoIds && effectiveDojoIds.length > 0) {
    gurtConditions.push(`m.dojo_id IN (${effectiveDojoIds.map(() => '?').join(',')})`);
    gurtParams.push(...effectiveDojoIds);
  } else {
    // Super-Admin ohne Dojo-Filter: nur verwaltete Dojos
    gurtConditions.push(`m.dojo_id NOT IN (SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin'))`);
  }
  const gurtWhereClause = 'WHERE ' + gurtConditions.join(' AND ');

  const queries = {
    gesamt: `SELECT COUNT(*) as gesamt,
  COUNT(DISTINCT CONCAT(DATE(pruefungsdatum), '_', CAST(stil_id AS CHAR))) as termine,
  SUM(CASE WHEN bestanden = 1 THEN 1 ELSE 0 END) as bestanden,
  SUM(CASE WHEN bestanden = 0 AND status = 'nicht_bestanden' THEN 1 ELSE 0 END) as nicht_bestanden,
  SUM(CASE WHEN status = 'geplant' THEN 1 ELSE 0 END) as geplant,
  SUM(COALESCE(pruefungsgebuehr, 0)) as gebuehren_gesamt,
  SUM(CASE WHEN gebuehr_bezahlt = 1 THEN COALESCE(pruefungsgebuehr, 0) ELSE 0 END) as gebuehren_bezahlt,
  SUM(CASE WHEN (gebuehr_bezahlt = 0 OR gebuehr_bezahlt IS NULL) AND status != 'geplant' AND pruefungsgebuehr > 0 THEN COALESCE(pruefungsgebuehr, 0) ELSE 0 END) as gebuehren_offen,
  SUM(CASE WHEN zahlungsart = 'bar' AND gebuehr_bezahlt = 1 THEN COALESCE(pruefungsgebuehr, 0) ELSE 0 END) as gebuehren_bar,
  SUM(CASE WHEN zahlungsart = 'lastschrift' AND gebuehr_bezahlt = 1 THEN COALESCE(pruefungsgebuehr, 0) ELSE 0 END) as gebuehren_lastschrift
FROM pruefungen ${whereClause}`,
    nach_stil: `SELECT s.name as stil_name, COUNT(*) as anzahl, SUM(CASE WHEN p.bestanden = 1 THEN 1 ELSE 0 END) as bestanden FROM pruefungen p INNER JOIN stile s ON p.stil_id = s.stil_id ${whereClause} GROUP BY s.stil_id, s.name ORDER BY anzahl DESC`,
    nach_monat: `SELECT YEAR(pruefungsdatum) as jahr, MONTH(pruefungsdatum) as monat, COUNT(*) as anzahl, SUM(CASE WHEN bestanden = 1 THEN 1 ELSE 0 END) as bestanden FROM pruefungen ${whereClause} GROUP BY YEAR(pruefungsdatum), MONTH(pruefungsdatum) ORDER BY jahr DESC, monat DESC LIMIT 12`,
    gurtverteilung: `SELECT g.name as graduierung_name, g.farbe_hex as farbe, g.reihenfolge, s.name as stil_name, COUNT(DISTINCT m.mitglied_id) as anzahl FROM mitglieder m INNER JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id INNER JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id INNER JOIN stile s ON g.stil_id = s.stil_id ${gurtWhereClause} GROUP BY g.graduierung_id, g.name, g.farbe_hex, g.reihenfolge, s.name ORDER BY s.name ASC, g.reihenfolge ASC`,
    wartezeit: `SELECT
  g_nach.name as graduierung_name, g_nach.farbe_hex as farbe, g_nach.reihenfolge,
  s.name as stil_name, COUNT(*) as anzahl,
  ROUND(AVG(TIMESTAMPDIFF(MONTH,
    COALESCE(
      (SELECT MAX(p2.pruefungsdatum) FROM pruefungen p2 WHERE p2.mitglied_id = p.mitglied_id AND p2.stil_id = p.stil_id AND p2.pruefungsdatum < p.pruefungsdatum AND p2.status IN ('bestanden','nicht_bestanden')),
      (SELECT m2.eintrittsdatum FROM mitglieder m2 WHERE m2.mitglied_id = p.mitglied_id)
    ), p.pruefungsdatum)), 1) as avg_wartezeit_monate
FROM pruefungen p
JOIN graduierungen g_nach ON p.graduierung_nachher_id = g_nach.graduierung_id
JOIN stile s ON g_nach.stil_id = s.stil_id
WHERE p.pruefungsdatum IS NOT NULL AND p.status IN ('bestanden','nicht_bestanden')${whereConditions.length > 0 ? ' AND ' + whereConditions.join(' AND ') : ''}
GROUP BY g_nach.graduierung_id, g_nach.name, g_nach.farbe_hex, g_nach.reihenfolge, s.name
HAVING COUNT(*) >= 2
ORDER BY s.name ASC, g_nach.reihenfolge ASC`
  };

  Promise.all([
    new Promise((resolve, reject) => { db.query(queries.gesamt, queryParams, (err, r) => err ? reject(err) : resolve(r[0])); }),
    new Promise((resolve, reject) => { db.query(queries.nach_stil, queryParams, (err, r) => err ? reject(err) : resolve(r)); }),
    new Promise((resolve, reject) => { db.query(queries.nach_monat, queryParams, (err, r) => err ? reject(err) : resolve(r)); }),
    new Promise((resolve, reject) => { db.query(queries.gurtverteilung, gurtParams, (err, r) => err ? reject(err) : resolve(r)); }),
    new Promise((resolve, reject) => { db.query(queries.wartezeit, queryParams, (err, r) => err ? reject(err) : resolve(r)); })
  ])
  .then(([gesamt, nach_stil, nach_monat, gurtverteilung, wartezeit]) => {
    res.json({ success: true, statistiken: { gesamt, nach_stil, nach_monat, gurtverteilung, wartezeit } });
  })
  .catch(err => {
    logger.error('Fehler bei Prüfungsstatistiken:', { error: err });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: ERROR_MESSAGES.GENERAL.LOADING_ERROR, details: err.message });
  });
});

/**
 * GET /statistiken/techniken
 * Aggregiert einzelbewertungen JSON → Technik-Ranking + Kategorie-Durchschnitte
 */
router.get('/statistiken/techniken', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const effectiveDojoId = secureDojoId !== null
    ? secureDojoId
    : (req.query.dojo_id && req.query.dojo_id !== 'all' ? parseInt(req.query.dojo_id) : null);

  try {
    const pool = db.promise();

    let dojoWhere, dojoParams;
    if (effectiveDojoId) {
      dojoWhere = 'AND p.dojo_id = ?';
      dojoParams = [effectiveDojoId];
    } else {
      dojoWhere = `AND p.dojo_id NOT IN (SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt','trainer','checkin'))`;
      dojoParams = [];
    }

    // Alle abgeschlossenen Prüfungen mit Bewertungen
    const [pruefungen] = await pool.query(
      `SELECT einzelbewertungen, stil_id FROM pruefungen p
       WHERE p.status IN ('bestanden','nicht_bestanden')
         AND p.einzelbewertungen IS NOT NULL ${dojoWhere}`,
      dojoParams
    );

    // Prüfungsinhalte für Namen (alle Stile des Dojos)
    const stilIds = [...new Set(pruefungen.map(p => p.stil_id).filter(Boolean))];
    const inhalteMap = {};
    if (stilIds.length > 0) {
      const [inhalte] = await pool.query(
        `SELECT pi.inhalt_id, pi.titel, pi.kategorie
         FROM pruefungsinhalte pi
         JOIN graduierungen g ON pi.graduierung_id = g.graduierung_id
         WHERE g.stil_id IN (${stilIds.map(() => '?').join(',')})`,
        stilIds
      );
      inhalte.forEach(i => { inhalteMap[i.inhalt_id] = i; });
    }

    // Aggregieren
    const techAgg = {};  // inhalt_id → { count, sum, bestandenCount, hasPunkte }
    const katAgg  = {};  // kategorie → { count, sum, max_sum, bestandenCount, hasPunkte }

    for (const prf of pruefungen) {
      let bew;
      try { bew = typeof prf.einzelbewertungen === 'string' ? JSON.parse(prf.einzelbewertungen) : prf.einzelbewertungen; }
      catch { continue; }
      if (!bew || typeof bew !== 'object') continue;

      for (const [kat, items] of Object.entries(bew)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const id = item.inhalt_id;
          if (!id) continue;

          const maxPkt = parseFloat(item.max_punktzahl) || 10;
          if (!techAgg[id]) techAgg[id] = { count: 0, sum: 0, bestandenCount: 0, hasPunkte: 0, max_punktzahl: maxPkt };
          techAgg[id].count++;
          techAgg[id].max_punktzahl = maxPkt; // immer aktuell halten
          if (item.bestanden === true) techAgg[id].bestandenCount++;
          if (item.punktzahl != null && item.punktzahl !== '') {
            techAgg[id].sum += parseFloat(item.punktzahl);
            techAgg[id].hasPunkte++;
          }

          if (!katAgg[kat]) katAgg[kat] = { count: 0, sum: 0, max_sum: 0, bestandenCount: 0, hasPunkte: 0 };
          katAgg[kat].count++;
          if (item.bestanden === true) katAgg[kat].bestandenCount++;
          if (item.punktzahl != null && item.punktzahl !== '') {
            katAgg[kat].sum += parseFloat(item.punktzahl);
            katAgg[kat].max_sum += maxPkt;
            katAgg[kat].hasPunkte++;
          }
        }
      }
    }

    const techniken = Object.entries(techAgg)
      .filter(([id]) => inhalteMap[id])
      .map(([id, a]) => ({
        inhalt_id: parseInt(id),
        titel: inhalteMap[id].titel,
        kategorie: inhalteMap[id].kategorie,
        max_punktzahl: a.max_punktzahl,
        count: a.count,
        avg_punkte: a.hasPunkte > 0 ? parseFloat((a.sum / a.hasPunkte).toFixed(1)) : null,
        avg_prozent: a.hasPunkte > 0 ? parseFloat(((a.sum / a.hasPunkte) / a.max_punktzahl * 100).toFixed(1)) : null,
        bestanden_quote: a.count > 0 ? parseFloat((a.bestandenCount / a.count * 100).toFixed(1)) : null
      }))
      .filter(t => t.avg_punkte !== null)
      .sort((a, b) => (b.avg_prozent || 0) - (a.avg_prozent || 0));

    const kategorieNamen = {
      kondition: 'Kondition / Warm Up', grundtechniken: 'Grundtechniken',
      fusstechniken: 'Fußtechniken', kata: 'Kata / Kombinationen',
      kumite: 'Kumite / Sparring', theorie: 'Theorie'
    };
    const kategorien = Object.entries(katAgg).map(([kat, a]) => ({
      kategorie: kat,
      label: kategorieNamen[kat] || kat,
      count: a.count,
      avg_punkte: a.hasPunkte > 0 ? parseFloat((a.sum / a.hasPunkte).toFixed(1)) : null,
      avg_prozent: a.hasPunkte > 0 && a.max_sum > 0
        ? parseFloat((a.sum / a.max_sum * 100).toFixed(1)) : null,
      bestanden_quote: a.count > 0 ? parseFloat((a.bestandenCount / a.count * 100).toFixed(1)) : null
    })).sort((a, b) => (b.avg_prozent || 0) - (a.avg_prozent || 0));

    res.json({ success: true, techniken, kategorien, total_pruefungen: pruefungen.length });
  } catch (err) {
    logger.error('Fehler bei Technik-Statistiken:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /statistiken/erweitert
 * Grad-Schwierigkeit, Top-Prüflinge, Wiederholer
 */
router.get('/statistiken/erweitert', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  const effectiveDojoId = secureDojoId !== null
    ? secureDojoId
    : (req.query.dojo_id && req.query.dojo_id !== 'all' ? parseInt(req.query.dojo_id) : null);

  try {
    const pool = db.promise();

    let dojoWhere, dojoParams;
    if (effectiveDojoId) {
      dojoWhere = 'AND p.dojo_id = ?';
      dojoParams = [effectiveDojoId];
    } else {
      dojoWhere = `AND p.dojo_id NOT IN (SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt','trainer','checkin'))`;
      dojoParams = [];
    }

    // 1. Pass/Fail je Graduierung (Schwierigkeitsranking)
    const [grad_stats] = await pool.query(
      `SELECT g.name AS graduierung_name, g.farbe_hex AS farbe, g.reihenfolge,
              s.name AS stil_name,
              COUNT(*) AS gesamt,
              SUM(CASE WHEN p.bestanden = 1 THEN 1 ELSE 0 END) AS bestanden,
              SUM(CASE WHEN p.status = 'nicht_bestanden' THEN 1 ELSE 0 END) AS nicht_bestanden
       FROM pruefungen p
       JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
       JOIN stile s ON g.stil_id = s.stil_id
       WHERE p.status IN ('bestanden','nicht_bestanden') ${dojoWhere}
       GROUP BY g.graduierung_id, g.name, g.farbe_hex, g.reihenfolge, s.name
       ORDER BY s.name ASC, g.reihenfolge ASC`,
      dojoParams
    );

    // 2. Top-Prüflinge nach Ø Punktzahl
    const [top_pruefling] = await pool.query(
      `SELECT m.vorname, m.nachname, m.mitglied_id,
              COUNT(*) AS anzahl,
              ROUND(AVG(p.punktzahl / p.max_punktzahl * 100), 1) AS avg_prozent
       FROM pruefungen p
       JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
       WHERE p.status = 'bestanden'
         AND p.punktzahl IS NOT NULL
         AND p.max_punktzahl IS NOT NULL
         AND p.max_punktzahl > 0
         ${dojoWhere}
       GROUP BY m.mitglied_id, m.vorname, m.nachname
       ORDER BY avg_prozent DESC
       LIMIT 10`,
      dojoParams
    );

    // 3. Wiederholer (gleiche Prüfung mehrfach abgelegt)
    const [[zweiter_anlauf]] = await pool.query(
      `SELECT
         COUNT(*) AS total_kombis,
         SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS wiederholer_kombis,
         SUM(CASE WHEN cnt > 1 THEN cnt - 1 ELSE 0 END) AS extra_versuche
       FROM (
         SELECT mitglied_id, graduierung_nachher_id, COUNT(*) AS cnt
         FROM pruefungen p
         WHERE p.status IN ('bestanden','nicht_bestanden') ${dojoWhere}
         GROUP BY mitglied_id, graduierung_nachher_id
       ) sub`,
      dojoParams
    );

    res.json({ success: true, grad_stats, top_pruefling, zweiter_anlauf });
  } catch (err) {
    logger.error('Fehler bei erweiterten Statistiken:', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
