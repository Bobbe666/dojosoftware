const express = require("express");
const logger = require('../utils/logger');
const db = require("../db"); // mysql2 pool
const router = express.Router();
const { getSecureDojoId, isSuperAdmin } = require('../middleware/tenantSecurity');

// Stundenplan abrufen
router.get("/", async (req, res) => {
  // 🔒 SICHERHEIT: Sichere Dojo-ID aus JWT Token (ignoriert Query-Params für normale User)
  const secureDojoId = getSecureDojoId(req);
  const isAdmin = isSuperAdmin(req);
  const { standort_id } = req.query; // Optional standort filter

  logger.debug('🔒 Stundenplan Tenant-Filter:', { secureDojoId, isAdmin });

  // 🔒 DOJO-FILTER: Baue WHERE-Bedingung
  const whereConditions = [];
  const queryParams = [];

  if (secureDojoId) {
    // Einzelnes Dojo (normaler Admin oder Super-Admin mit gewähltem Dojo)
    whereConditions.push('k.dojo_id = ?');
    queryParams.push(secureDojoId);
  } else if (isAdmin && req.query.dojo_ids) {
    // Super-Admin "Alle Dojos" Modus: nur zugeordnete Dojos
    const ids = req.query.dojo_ids.split(',').map(Number).filter(n => n > 0 && !isNaN(n));
    if (ids.length > 0) {
      whereConditions.push(`k.dojo_id IN (${ids.map(() => '?').join(',')})`);
      queryParams.push(...ids);
    }
  } else if (!isAdmin) {
    // Kein Dojo-Filter für normalen User → nichts zurückgeben
    return res.json([]);
  }
  // Super-Admin ohne jeglichen Filter → alle Daten (wird durch Frontend-Guard verhindert)

  // Add standort filter if provided
  if (standort_id && standort_id !== 'all') {
    whereConditions.push('s.standort_id = ?');
    queryParams.push(parseInt(standort_id));
  }

  // Add kurs_id filter if provided (Cockpit: Stundenplan für einzelnen Kurs)
  if (req.query.kurs_id) {
    whereConditions.push('s.kurs_id = ?');
    queryParams.push(parseInt(req.query.kurs_id, 10));
  }

  const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT
      s.stundenplan_id AS id,
      s.tag,
      s.uhrzeit_start,
      s.uhrzeit_ende,
      s.kurs_id,
      s.raum_id,
      s.standort_id,
      k.gruppenname AS kursname,
      k.stil,
      t.vorname AS trainer_vorname,
      t.nachname AS trainer_nachname,
      r.name AS raumname,
      st.name AS standort_name,
      st.farbe AS standort_farbe,
      k.max_teilnehmer
    FROM stundenplan s
    LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
    LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
    LEFT JOIN raeume r ON s.raum_id = r.id
    LEFT JOIN standorte st ON s.standort_id = st.standort_id
    ${whereClause}
    ORDER BY FIELD(s.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'),
             s.uhrzeit_start;
  `;

  try {
    const [rows, fields] = await db.promise().query(query, queryParams); // Use promise-based query with mysql2

    // Leere Liste ist OK, kein Fehler - Frontend kann damit umgehen
    res.json(rows);
  } catch (err) {
    logger.error('Fehler beim Abrufen der Stundenplan-Daten:', { error: err });
    res.status(500).json({ error: "Fehler beim Abrufen der Stundenplan-Daten", details: err.message });
  }
});
// Neuen Stundenplan-Eintrag hinzufügen
router.post("/", async (req, res) => {
  const { tag, uhrzeit_start, uhrzeit_ende, kurs_id, raum_id } = req.body;

  if (!tag || !uhrzeit_start || !uhrzeit_ende || !kurs_id) {
    return res.status(400).json({ error: "Alle Felder müssen ausgefüllt werden." });
  }

  try {
    // Get standort_id from the selected kurs
    const [kursRows] = await db.promise().query('SELECT standort_id FROM kurse WHERE kurs_id = ?', [kurs_id]);

    if (kursRows.length === 0) {
      return res.status(400).json({ error: "Kurs nicht gefunden" });
    }

    const standort_id = kursRows[0].standort_id;

    const sql = `
      INSERT INTO stundenplan (tag, uhrzeit_start, uhrzeit_ende, kurs_id, raum_id, standort_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.promise().query(sql, [
      tag,
      uhrzeit_start,
      uhrzeit_ende,
      kurs_id,
      raum_id || null,
      standort_id
    ]);

    // Hole die vollständigen Daten mit JOINs für die Response
    const [newEntry] = await db.promise().query(`
      SELECT
        s.stundenplan_id AS id,
        s.tag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        s.kurs_id,
        s.raum_id,
        s.standort_id,
        k.gruppenname AS kursname,
        k.stil,
        t.vorname AS trainer_vorname,
        t.nachname AS trainer_nachname,
        r.name AS raumname,
        st.name AS standort_name,
        st.farbe AS standort_farbe
      FROM stundenplan s
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      LEFT JOIN raeume r ON s.raum_id = r.id
      LEFT JOIN standorte st ON s.standort_id = st.standort_id
      WHERE s.stundenplan_id = ?
    `, [result.insertId]);

    res.status(201).json(newEntry[0]);
  } catch (err) {
    logger.error('Fehler beim Einfügen des Stundenplan-Eintrags:', { error: err });
    res.status(500).json({ error: "Fehler beim Einfügen", details: err.message });
  }
});

// Stundenplan-Eintrag aktualisieren
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { tag, uhrzeit_start, uhrzeit_ende, kurs_id, raum_id } = req.body;

  if (!tag || !uhrzeit_start || !uhrzeit_ende || !kurs_id) {
    return res.status(400).json({ error: "Alle Felder müssen ausgefüllt werden." });
  }

  const sql = `
    UPDATE stundenplan 
    SET tag = ?, uhrzeit_start = ?, uhrzeit_ende = ?, kurs_id = ?, raum_id = ?
    WHERE stundenplan_id = ?
  `;

  try {
    const [result] = await db.promise().query(sql, [
      tag,
      uhrzeit_start,
      uhrzeit_ende,
      kurs_id,
      raum_id || null,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Stundenplan-Eintrag nicht gefunden" });
    }

    // Hole die vollständigen Daten mit JOINs für die Response
    const [updatedEntry] = await db.promise().query(`
      SELECT
        s.stundenplan_id AS id,
        s.tag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        s.kurs_id,
        s.raum_id,
        k.gruppenname AS kursname,
        k.stil,
        t.vorname AS trainer_vorname,
        t.nachname AS trainer_nachname,
        r.name AS raumname
      FROM stundenplan s
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      LEFT JOIN raeume r ON s.raum_id = r.id
      WHERE s.stundenplan_id = ?
    `, [id]);

    res.json(updatedEntry[0]);
  } catch (err) {
    logger.error('Fehler beim Aktualisieren des Stundenplan-Eintrags:', { error: err });
    res.status(500).json({ error: "Fehler beim Aktualisieren", details: err.message });
  }
});

// Stundenplan-Eintrag löschen
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM stundenplan WHERE stundenplan_id = ?";

  try {
    const [result] = await db.promise().query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Stundenplan-Eintrag nicht gefunden" });
    }

    res.json({ success: true, message: "Stundenplan-Eintrag erfolgreich gelöscht" });
  } catch (err) {
    logger.error('Fehler beim Löschen des Stundenplan-Eintrags:', { error: err });
    res.status(500).json({ error: "Fehler beim Löschen", details: err.message });
  }
});

// Kommende Termine für ein Mitglied generieren (basierend auf Stundenplan und Anwesenheitshistorie)
router.get("/member/:mitglied_id/termine", async (req, res) => {
  const { mitglied_id } = req.params;

  try {
    // 1. Hole Anwesenheitshistorie des Mitglieds (welche Kurse besucht das Mitglied?)
    const [anwesenheitRows] = await db.promise().query(`
      SELECT DISTINCT stundenplan_id
      FROM anwesenheit
      WHERE mitglied_id = ?
    `, [mitglied_id]);

    if (anwesenheitRows.length === 0) {

      return res.json([]); // Keine Historie = keine Termine
    }

    const stundenplanIds = anwesenheitRows.map(row => row.stundenplan_id);

    // 2. Hole Stundenplan-Details für diese Kurse
    const placeholders = stundenplanIds.map(() => '?').join(',');
    const [stundenplanRows] = await db.promise().query(`
      SELECT
        s.stundenplan_id AS id,
        s.tag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        s.kurs_id,
        s.raum_id,
        k.gruppenname AS kursname,
        k.stil,
        t.vorname AS trainer_vorname,
        t.nachname AS trainer_nachname,
        r.name AS raumname
      FROM stundenplan s
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      LEFT JOIN raeume r ON s.raum_id = r.id
      WHERE s.stundenplan_id IN (${placeholders})
      ORDER BY FIELD(s.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'),
               s.uhrzeit_start
    `, stundenplanIds);

    // 3. Generiere kommende Termine (nächste 4 Wochen)
    const termine = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 28); // 4 Wochen voraus

    const dayNameToNumber = {
      'Sonntag': 0,
      'Montag': 1,
      'Dienstag': 2,
      'Mittwoch': 3,
      'Donnerstag': 4,
      'Freitag': 5,
      'Samstag': 6
    };

    for (const kurs of stundenplanRows) {
      const targetDayNumber = dayNameToNumber[kurs.tag];

      // Finde alle Daten für diesen Wochentag in den nächsten 4 Wochen
      let currentDate = new Date(today);

      // Gehe zum nächsten Vorkommen des Wochentags
      while (currentDate.getDay() !== targetDayNumber) {
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Sammle alle Vorkommen dieses Wochentags bis zum Enddatum
      while (currentDate <= endDate) {
        termine.push({
          id: `${kurs.id}-${currentDate.toISOString().split('T')[0]}`,
          title: kurs.kursname || 'Kurs',
          trainer: `${kurs.trainer_vorname || ''} ${kurs.trainer_nachname || ''}`.trim() || 'Kein Trainer zugeordnet',
          zeit: `${kurs.uhrzeit_start} - ${kurs.uhrzeit_ende}`,
          datum: currentDate.toISOString().split('T')[0],
          raum: kurs.raumname || 'Kein Raum',
          typ: 'training',
          status: 'bestätigt',
          stundenplan_id: kurs.id,
          stil: kurs.stil
        });

        currentDate.setDate(currentDate.getDate() + 7); // Nächste Woche
      }
    }

    // 4. Sortiere nach Datum
    termine.sort((a, b) => new Date(a.datum) - new Date(b.datum));

    res.json(termine);
  } catch (err) {
    logger.error('Fehler beim Generieren der Termine:', { error: err });
    res.status(500).json({ error: "Fehler beim Generieren der Termine", details: err.message });
  }
});

module.exports = router;
