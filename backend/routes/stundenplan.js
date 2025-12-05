const express = require("express");
const db = require("../db"); // mysql2 pool
const router = express.Router();

// Stundenplan abrufen
router.get("/", async (req, res) => {

  const query = `
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
    ORDER BY FIELD(s.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'), 
             s.uhrzeit_start;
  `;

  try {
    const [rows, fields] = await db.promise().query(query); // Use promise-based query with mysql2

    // Leere Liste ist OK, kein Fehler - Frontend kann damit umgehen
    res.json(rows);
  } catch (err) {
    console.error("Fehler beim Abrufen der Stundenplan-Daten:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Stundenplan-Daten", details: err.message });
  }
});
// Neuen Stundenplan-Eintrag hinzufügen
router.post("/", async (req, res) => {
  const { tag, uhrzeit_start, uhrzeit_ende, kurs_id, raum_id } = req.body;

  if (!tag || !uhrzeit_start || !uhrzeit_ende || !kurs_id) {
    return res.status(400).json({ error: "Alle Felder müssen ausgefüllt werden." });
  }

  const sql = `
    INSERT INTO stundenplan (tag, uhrzeit_start, uhrzeit_ende, kurs_id, raum_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  try {
    const [result] = await db.promise().query(sql, [
      tag,
      uhrzeit_start,
      uhrzeit_ende,
      kurs_id,
      raum_id || null,
    ]);

    res.status(201).json({
      id: result.insertId,
      tag,
      uhrzeit_start,
      uhrzeit_ende,
      kurs_id,
      raum_id: raum_id || null,
    });
  } catch (err) {
    console.error("Fehler beim Einfügen des Stundenplan-Eintrags:", err);
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

    res.json({
      success: true,
      id,
      tag,
      uhrzeit_start,
      uhrzeit_ende,
      kurs_id,
      raum_id: raum_id || null,
    });
  } catch (err) {
    console.error("Fehler beim Aktualisieren des Stundenplan-Eintrags:", err);
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
    console.error("Fehler beim Löschen des Stundenplan-Eintrags:", err);
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
    console.error("Fehler beim Generieren der Termine:", err);
    res.status(500).json({ error: "Fehler beim Generieren der Termine", details: err.message });
  }
});

module.exports = router;
