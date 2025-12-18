// ============================================================================
// EVENTS API - VOLLSTÄNDIGE BACKEND-ROUTE
// Backend/routes/events.js
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Validiert Event-Daten
 */
function validateEventData(data) {
  const errors = [];

  if (!data.titel || data.titel.trim() === '') {
    errors.push('Titel ist erforderlich');
  }
  if (!data.datum) {
    errors.push('Datum ist erforderlich');
  }
  if (!data.dojo_id) {
    errors.push('Dojo-ID ist erforderlich');
  }

  return errors;
}

/**
 * Berechnet verfügbare Plätze
 */
function getAvailableSlots(event, anmeldungen) {
  if (!event.max_teilnehmer) return null; // Unbegrenzt
  const angemeldet = anmeldungen.filter(a =>
    a.status === 'angemeldet' || a.status === 'bestaetigt'
  ).length;
  return event.max_teilnehmer - angemeldet;
}

// ============================================================================
// GET ENDPUNKTE
// ============================================================================

/**
 * GET /api/events
 * Holt alle Events (mit optionalem Dojo-Filter)
 */
router.get('/', (req, res) => {
  const { dojo_id, status, upcoming } = req.query;

  let query = `
    SELECT
      e.*,
      COUNT(DISTINCT ea.anmeldung_id) as anzahl_anmeldungen,
      d.dojoname as dojo_name,
      r.name as raum_name
    FROM events e
    LEFT JOIN event_anmeldungen ea ON e.event_id = ea.event_id
      AND ea.status IN ('angemeldet', 'bestaetigt')
    LEFT JOIN dojo d ON e.dojo_id = d.id
    LEFT JOIN raeume r ON e.raum_id = r.id
    WHERE 1=1
  `;

  const params = [];

  if (dojo_id) {
    query += ' AND e.dojo_id = ?';
    params.push(dojo_id);
  }

  if (status) {
    query += ' AND e.status = ?';
    params.push(status);
  }

  if (upcoming === 'true') {
    query += ' AND e.datum >= CURDATE()';
  }

  query += ' GROUP BY e.event_id ORDER BY e.datum ASC, e.uhrzeit_beginn ASC';

  db.query(query, params, (err, events) => {
    if (err) {
      console.error('Fehler beim Abrufen der Events:', err);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der Events',
        details: err.message
      });
    }

    // Berechne verfügbare Plätze für jedes Event
    const eventsWithSlots = events.map(event => ({
      ...event,
      verfuegbare_plaetze: event.max_teilnehmer
        ? event.max_teilnehmer - event.anzahl_anmeldungen
        : null,
      ist_ausgebucht: event.max_teilnehmer
        ? event.anzahl_anmeldungen >= event.max_teilnehmer
        : false
    }));

    res.json(eventsWithSlots);
  });
});

/**
 * GET /api/events/:id
 * Holt ein einzelnes Event mit Details
 */
router.get('/:id', (req, res) => {
  const eventId = req.params.id;

  const query = `
    SELECT
      e.*,
      d.dojoname as dojo_name,
      r.name as raum_name,
      COUNT(DISTINCT ea.anmeldung_id) as anzahl_anmeldungen
    FROM events e
    LEFT JOIN dojo d ON e.dojo_id = d.id
    LEFT JOIN raeume r ON e.raum_id = r.id
    LEFT JOIN event_anmeldungen ea ON e.event_id = ea.event_id
      AND ea.status IN ('angemeldet', 'bestaetigt')
    WHERE e.event_id = ?
    GROUP BY e.event_id
  `;

  db.query(query, [eventId], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen des Events:', err);
      return res.status(500).json({
        error: 'Fehler beim Abrufen des Events',
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = results[0];
    event.verfuegbare_plaetze = event.max_teilnehmer
      ? event.max_teilnehmer - event.anzahl_anmeldungen
      : null;
    event.ist_ausgebucht = event.max_teilnehmer
      ? event.anzahl_anmeldungen >= event.max_teilnehmer
      : false;

    res.json(event);
  });
});

/**
 * GET /api/events/:id/anmeldungen
 * Holt alle Anmeldungen für ein Event
 */
router.get('/:id/anmeldungen', (req, res) => {
  const eventId = req.params.id;

  const query = `
    SELECT
      ea.*,
      m.vorname,
      m.nachname,
      m.email,
      m.telefon
    FROM event_anmeldungen ea
    JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
    WHERE ea.event_id = ?
    ORDER BY ea.anmeldedatum ASC
  `;

  db.query(query, [eventId], (err, anmeldungen) => {
    if (err) {
      console.error('Fehler beim Abrufen der Anmeldungen:', err);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der Anmeldungen',
        details: err.message
      });
    }

    res.json(anmeldungen);
  });
});

/**
 * GET /api/events/mitglied/:mitglied_id
 * Holt alle Events eines Mitglieds
 */
router.get('/mitglied/:mitglied_id', (req, res) => {
  const mitgliedId = req.params.mitglied_id;

  const query = `
    SELECT
      e.*,
      ea.anmeldung_id,
      ea.status as anmeldung_status,
      ea.bezahlt,
      ea.anmeldedatum,
      d.dojoname as dojo_name,
      r.name as raum_name
    FROM event_anmeldungen ea
    JOIN events e ON ea.event_id = e.event_id
    LEFT JOIN dojo d ON e.dojo_id = d.id
    LEFT JOIN raeume r ON e.raum_id = r.id
    WHERE ea.mitglied_id = ?
    ORDER BY e.datum DESC, e.uhrzeit_beginn DESC
  `;

  db.query(query, [mitgliedId], (err, events) => {
    if (err) {
      console.error('Fehler beim Abrufen der Mitglieder-Events:', err);
      return res.status(500).json({
        error: 'Fehler beim Abrufen der Events',
        details: err.message
      });
    }

    res.json(events);
  });
});

// ============================================================================
// POST ENDPUNKTE
// ============================================================================

/**
 * POST /api/events
 * Erstellt ein neues Event
 */
router.post('/', (req, res) => {
  const eventData = req.body;

  // Validierung
  const errors = validateEventData(eventData);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validierungsfehler',
      details: errors
    });
  }

  const query = `
    INSERT INTO events (
      titel, beschreibung, event_typ, datum, uhrzeit_beginn, uhrzeit_ende,
      ort, raum_id, max_teilnehmer, teilnahmegebuehr, anmeldefrist, status,
      trainer_ids, dojo_id, bild_url, anforderungen
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    eventData.titel,
    eventData.beschreibung || null,
    eventData.event_typ || 'Sonstiges',
    eventData.datum,
    eventData.uhrzeit_beginn || null,
    eventData.uhrzeit_ende || null,
    eventData.ort || null,
    eventData.raum_id || null,
    eventData.max_teilnehmer || null,
    eventData.teilnahmegebuehr || 0.00,
    eventData.anmeldefrist || null,
    eventData.status || 'geplant',
    eventData.trainer_ids ? eventData.trainer_ids.join(',') : null,
    eventData.dojo_id,
    eventData.bild_url || null,
    eventData.anforderungen || null
  ];

  db.query(query, params, async (err, result) => {
    if (err) {
      console.error('Fehler beim Erstellen des Events:', err);
      return res.status(500).json({
        error: 'Fehler beim Erstellen des Events',
        details: err.message
      });
    }

    const eventId = result.insertId;

    // Automatische Benachrichtigung an alle Mitglieder senden
    try {
      const [mitglieder] = await db.promise().query(
        'SELECT mitglied_id, email, vorname, nachname FROM mitglieder WHERE status = "aktiv"'
      );

      const notificationMessage = `Neues Event: ${eventData.titel} am ${eventData.datum}`;
      const notificationDetails = eventData.beschreibung || 'Melden Sie sich jetzt an!';

      // Erstelle Benachrichtigungen für alle aktiven Mitglieder
      for (const mitglied of mitglieder) {
        await db.promise().query(
          `INSERT INTO notifications (mitglied_id, email, type, message, details, link, created_at)
           VALUES (?, ?, 'event_neu', ?, ?, ?, NOW())`,
          [
            mitglied.mitglied_id,
            mitglied.email,
            notificationMessage,
            notificationDetails,
            `/member/events`
          ]
        );
      }

      console.log(`✅ Event ${eventId} erstellt und ${mitglieder.length} Benachrichtigungen versendet`);
    } catch (notifErr) {
      console.error('Fehler beim Versenden der Benachrichtigungen:', notifErr);
      // Fehler bei Benachrichtigungen nicht kritisch - Event wurde trotzdem erstellt
    }

    res.status(201).json({
      message: 'Event erfolgreich erstellt',
      event_id: eventId
    });
  });
});

/**
 * POST /api/events/:id/anmelden
 * Meldet ein Mitglied für ein Event an
 */
router.post('/:id/anmelden', (req, res) => {
  const eventId = req.params.id;
  const { mitglied_id, bemerkung } = req.body;

  if (!mitglied_id) {
    return res.status(400).json({ error: 'Mitglied-ID fehlt' });
  }

  // Prüfe ob Event existiert und nicht ausgebucht ist
  const checkQuery = `
    SELECT
      e.*,
      COUNT(DISTINCT ea.anmeldung_id) as anzahl_anmeldungen
    FROM events e
    LEFT JOIN event_anmeldungen ea ON e.event_id = ea.event_id
      AND ea.status IN ('angemeldet', 'bestaetigt')
    WHERE e.event_id = ?
    GROUP BY e.event_id
  `;

  db.query(checkQuery, [eventId], (err, results) => {
    if (err) {
      console.error('Fehler beim Prüfen des Events:', err);
      return res.status(500).json({
        error: 'Fehler beim Prüfen des Events',
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = results[0];

    // Prüfe Ausgebucht
    if (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer) {
      return res.status(400).json({
        error: 'Event ist ausgebucht',
        max_teilnehmer: event.max_teilnehmer,
        aktuelle_anmeldungen: event.anzahl_anmeldungen
      });
    }

    // Prüfe Anmeldefrist
    if (event.anmeldefrist) {
      const frist = new Date(event.anmeldefrist);
      const heute = new Date();
      if (heute > frist) {
        return res.status(400).json({
          error: 'Anmeldefrist ist abgelaufen',
          anmeldefrist: event.anmeldefrist
        });
      }
    }

    // Erstelle Anmeldung
    const insertQuery = `
      INSERT INTO event_anmeldungen (event_id, mitglied_id, bemerkung, status)
      VALUES (?, ?, ?, 'angemeldet')
    `;

    db.query(insertQuery, [eventId, mitglied_id, bemerkung || null], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Sie sind bereits für dieses Event angemeldet' });
        }
        console.error('Fehler beim Anmelden:', err);
        return res.status(500).json({
          error: 'Fehler beim Anmelden',
          details: err.message
        });
      }

      // Update Event Status wenn ausgebucht
      if (event.max_teilnehmer && (event.anzahl_anmeldungen + 1) >= event.max_teilnehmer) {
        db.query(
          'UPDATE events SET status = "ausgebucht" WHERE event_id = ?',
          [eventId],
          (err) => {
            if (err) console.error('Fehler beim Update des Event-Status:', err);
          }
        );
      }

      res.status(201).json({
        message: 'Erfolgreich angemeldet',
        anmeldung_id: result.insertId
      });
    });
  });
});

/**
 * POST /api/events/:id/abmelden
 * Meldet ein Mitglied von einem Event ab
 */
router.post('/:id/abmelden', (req, res) => {
  const eventId = req.params.id;
  const { mitglied_id } = req.body;

  if (!mitglied_id) {
    return res.status(400).json({ error: 'Mitglied-ID fehlt' });
  }

  const query = `
    UPDATE event_anmeldungen
    SET status = 'abgesagt', updated_at = CURRENT_TIMESTAMP
    WHERE event_id = ? AND mitglied_id = ?
  `;

  db.query(query, [eventId, mitglied_id], (err, result) => {
    if (err) {
      console.error('Fehler beim Abmelden:', err);
      return res.status(500).json({
        error: 'Fehler beim Abmelden',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Anmeldung nicht gefunden' });
    }

    // Update Event Status falls es ausgebucht war
    db.query(
      'UPDATE events SET status = "anmeldung_offen" WHERE event_id = ? AND status = "ausgebucht"',
      [eventId],
      (err) => {
        if (err) console.error('Fehler beim Update des Event-Status:', err);
      }
    );

    res.json({ message: 'Erfolgreich abgemeldet' });
  });
});

// ============================================================================
// PUT ENDPUNKTE
// ============================================================================

/**
 * PUT /api/events/:id
 * Aktualisiert ein Event
 */
router.put('/:id', (req, res) => {
  const eventId = req.params.id;
  const eventData = req.body;

  const query = `
    UPDATE events SET
      titel = ?,
      beschreibung = ?,
      event_typ = ?,
      datum = ?,
      uhrzeit_beginn = ?,
      uhrzeit_ende = ?,
      ort = ?,
      raum_id = ?,
      max_teilnehmer = ?,
      teilnahmegebuehr = ?,
      anmeldefrist = ?,
      status = ?,
      trainer_ids = ?,
      bild_url = ?,
      anforderungen = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE event_id = ?
  `;

  const params = [
    eventData.titel,
    eventData.beschreibung || null,
    eventData.event_typ || 'Sonstiges',
    eventData.datum,
    eventData.uhrzeit_beginn || null,
    eventData.uhrzeit_ende || null,
    eventData.ort || null,
    eventData.raum_id || null,
    eventData.max_teilnehmer || null,
    eventData.teilnahmegebuehr || 0.00,
    eventData.anmeldefrist || null,
    eventData.status || 'geplant',
    eventData.trainer_ids ? eventData.trainer_ids.join(',') : null,
    eventData.bild_url || null,
    eventData.anforderungen || null,
    eventId
  ];

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren des Events:', err);
      return res.status(500).json({
        error: 'Fehler beim Aktualisieren des Events',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    res.json({ message: 'Event erfolgreich aktualisiert' });
  });
});

/**
 * PUT /api/events/anmeldungen/:anmeldung_id
 * Aktualisiert eine Anmeldung (Status, Bezahlung, etc.)
 */
router.put('/anmeldungen/:anmeldung_id', (req, res) => {
  const anmeldungId = req.params.anmeldung_id;
  const { status, bezahlt, bemerkung } = req.body;

  let query = 'UPDATE event_anmeldungen SET updated_at = CURRENT_TIMESTAMP';
  const params = [];

  if (status) {
    query += ', status = ?';
    params.push(status);
  }

  if (bezahlt !== undefined) {
    query += ', bezahlt = ?, bezahldatum = ?';
    params.push(bezahlt, bezahlt ? new Date() : null);
  }

  if (bemerkung !== undefined) {
    query += ', bemerkung = ?';
    params.push(bemerkung);
  }

  query += ' WHERE anmeldung_id = ?';
  params.push(anmeldungId);

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren der Anmeldung:', err);
      return res.status(500).json({
        error: 'Fehler beim Aktualisieren der Anmeldung',
        details: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Anmeldung nicht gefunden' });
    }

    res.json({ message: 'Anmeldung erfolgreich aktualisiert' });
  });
});

// ============================================================================
// DELETE ENDPUNKTE
// ============================================================================

/**
 * DELETE /api/events/:id
 * Löscht ein Event
 */
router.delete('/:id', (req, res) => {
  const eventId = req.params.id;

  // Prüfe ob Anmeldungen existieren
  db.query(
    'SELECT COUNT(*) as count FROM event_anmeldungen WHERE event_id = ?',
    [eventId],
    (err, results) => {
      if (err) {
        console.error('Fehler beim Prüfen der Anmeldungen:', err);
        return res.status(500).json({
          error: 'Fehler beim Prüfen der Anmeldungen',
          details: err.message
        });
      }

      if (results[0].count > 0) {
        return res.status(400).json({
          error: 'Event kann nicht gelöscht werden',
          message: 'Es existieren noch Anmeldungen für dieses Event',
          anmeldungen: results[0].count
        });
      }

      // Lösche Event
      db.query('DELETE FROM events WHERE event_id = ?', [eventId], (err, result) => {
        if (err) {
          console.error('Fehler beim Löschen des Events:', err);
          return res.status(500).json({
            error: 'Fehler beim Löschen des Events',
            details: err.message
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Event nicht gefunden' });
        }

        res.json({ message: 'Event erfolgreich gelöscht' });
      });
    }
  );
});

// ============================================================================
// EVENT-ANMELDUNGEN (Member-Login)
// ============================================================================

/**
 * POST /api/events/:id/anmelden
 * Mitglied meldet sich für ein Event an
 */
router.post('/:id/anmelden', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { mitglied_id, notizen } = req.body;

  if (!mitglied_id) {
    return res.status(400).json({ error: 'Mitglied-ID fehlt' });
  }

  try {
    // 1. Prüfe ob Event existiert und ob noch Plätze frei sind
    const [eventRows] = await db.promise().query(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = eventRows[0];

    // 2. Prüfe ob Anmeldefrist noch läuft
    if (event.anmeldefrist && new Date(event.anmeldefrist) < new Date()) {
      return res.status(400).json({ error: 'Anmeldefrist ist abgelaufen' });
    }

    // 3. Prüfe ob bereits angemeldet
    const [existingRows] = await db.promise().query(
      'SELECT * FROM event_anmeldungen WHERE event_id = ? AND mitglied_id = ?',
      [eventId, mitglied_id]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Sie sind bereits für dieses Event angemeldet' });
    }

    // 4. Zähle aktuelle Anmeldungen
    const [countRows] = await db.promise().query(
      "SELECT COUNT(*) as count FROM event_anmeldungen WHERE event_id = ? AND status IN ('angemeldet', 'bestaetigt')",
      [eventId]
    );

    const currentCount = countRows[0].count;

    if (event.max_teilnehmer && currentCount >= event.max_teilnehmer) {
      return res.status(400).json({ error: 'Event ist bereits ausgebucht' });
    }

    // 5. Erstelle Anmeldung
    const [result] = await db.promise().query(
      `INSERT INTO event_anmeldungen
       (event_id, mitglied_id, status, anmeldedatum, notizen)
       VALUES (?, ?, 'angemeldet', NOW(), ?)`,
      [eventId, mitglied_id, notizen || null]
    );

    console.log(`✅ Mitglied ${mitglied_id} für Event ${eventId} angemeldet`);

    res.json({
      success: true,
      message: 'Erfolgreich für Event angemeldet',
      anmeldung_id: result.insertId
    });
  } catch (error) {
    console.error('Fehler bei Event-Anmeldung:', error);
    res.status(500).json({ error: 'Fehler bei der Event-Anmeldung' });
  }
});

/**
 * DELETE /api/events/:id/anmelden
 * Mitglied meldet sich von einem Event ab
 */
router.delete('/:id/anmelden', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { mitglied_id } = req.body;

  if (!mitglied_id) {
    return res.status(400).json({ error: 'Mitglied-ID fehlt' });
  }

  try {
    // 1. Prüfe ob Anmeldung existiert
    const [rows] = await db.promise().query(
      'SELECT * FROM event_anmeldungen WHERE event_id = ? AND mitglied_id = ?',
      [eventId, mitglied_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Keine Anmeldung gefunden' });
    }

    // 2. Lösche Anmeldung
    await db.promise().query(
      'DELETE FROM event_anmeldungen WHERE event_id = ? AND mitglied_id = ?',
      [eventId, mitglied_id]
    );

    console.log(`✅ Mitglied ${mitglied_id} von Event ${eventId} abgemeldet`);

    res.json({
      success: true,
      message: 'Erfolgreich von Event abgemeldet'
    });
  } catch (error) {
    console.error('Fehler bei Event-Abmeldung:', error);
    res.status(500).json({ error: 'Fehler bei der Event-Abmeldung' });
  }
});

/**
 * GET /api/events/member/:mitglied_id
 * Alle Events mit Anmeldestatus für ein Mitglied
 */
router.get('/member/:mitglied_id', async (req, res) => {
  const mitgliedId = parseInt(req.params.mitglied_id);

  try {
    const query = `
      SELECT
        e.*,
        COUNT(DISTINCT ea.anmeldung_id) as anzahl_anmeldungen,
        d.dojoname as dojo_name,
        r.name as raum_name,
        CASE
          WHEN ea_member.anmeldung_id IS NOT NULL THEN 1
          ELSE 0
        END as ist_angemeldet,
        ea_member.status as anmeldung_status,
        ea_member.anmeldedatum as mein_anmeldedatum
      FROM events e
      LEFT JOIN event_anmeldungen ea ON e.event_id = ea.event_id
        AND ea.status IN ('angemeldet', 'bestaetigt')
      LEFT JOIN event_anmeldungen ea_member ON e.event_id = ea_member.event_id
        AND ea_member.mitglied_id = ?
      LEFT JOIN dojo d ON e.dojo_id = d.id
      LEFT JOIN raeume r ON e.raum_id = r.id
      WHERE e.status = 'aktiv'
        AND e.datum >= CURDATE()
      GROUP BY e.event_id
      ORDER BY e.datum ASC, e.uhrzeit_beginn ASC
    `;

    const [rows] = await db.promise().query(query, [mitgliedId]);

    res.json({
      success: true,
      events: rows
    });
  } catch (error) {
    console.error('Fehler beim Laden der Member-Events:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Events' });
  }
});

/**
 * POST /api/events/:id/admin-anmelden
 * Admin fügt Mitglied zu Event hinzu (umgeht alle Validierungen)
 */
router.post('/:id/admin-anmelden', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { mitglied_id, bemerkung, bezahlt } = req.body;

  if (!mitglied_id) {
    return res.status(400).json({ error: 'Mitglied-ID fehlt' });
  }

  try {
    // 1. Prüfe ob Event existiert
    const [eventRows] = await db.promise().query(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = eventRows[0];

    // 2. Prüfe ob Mitglied existiert
    const [memberRows] = await db.promise().query(
      'SELECT mitglied_id, vorname, nachname, email FROM mitglieder WHERE mitglied_id = ?',
      [mitglied_id]
    );

    if (memberRows.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = memberRows[0];

    // 3. Prüfe ob bereits angemeldet (Duplicate Check)
    const [existingRows] = await db.promise().query(
      'SELECT * FROM event_anmeldungen WHERE event_id = ? AND mitglied_id = ?',
      [eventId, mitglied_id]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Mitglied ist bereits für dieses Event angemeldet' });
    }

    // 4. Admin-Anmeldung erstellen (UMGEHT alle Validierungen)
    // - Keine Deadline-Prüfung
    // - Keine Max-Teilnehmer-Prüfung
    // - Status: bestaetigt
    // - Bezahlt: Wert aus Request (true/false)
    // - Bezahldatum: NOW() wenn bezahlt, sonst NULL
    const bezahldatum = bezahlt ? 'NOW()' : 'NULL';
    const [result] = await db.promise().query(
      `INSERT INTO event_anmeldungen
       (event_id, mitglied_id, status, anmeldedatum, bezahlt, bezahldatum, bemerkung)
       VALUES (?, ?, 'bestaetigt', NOW(), ?, ${bezahldatum}, ?)`,
      [eventId, mitglied_id, bezahlt || false, bemerkung || 'Durch Admin hinzugefügt']
    );

    console.log(`✅ Admin hat Mitglied ${mitglied_id} zu Event ${eventId} hinzugefügt`);

    // 5. Benachrichtigung an Mitglied senden (Optional: Email)
    // TODO: Email-Service implementieren wenn verfügbar
    try {
      // Einfache Konsolen-Notification für jetzt
      console.log(`📧 Benachrichtigung an ${member.email}:`);
      console.log(`   Event: ${event.titel}`);
      console.log(`   Datum: ${new Date(event.datum).toLocaleDateString('de-DE')}`);
      console.log(`   Status: Bestätigt - Zahlung: ${bezahlt ? 'Bezahlt' : 'Offen'}`);

      // Falls Email-Service existiert, hier aufrufen:
      // await sendEventNotification(member.email, event, 'admin-added');
    } catch (notifError) {
      console.error('⚠️ Fehler beim Senden der Benachrichtigung:', notifError);
      // Fehler bei Benachrichtigung soll Anmeldung nicht verhindern
    }

    res.json({
      success: true,
      message: `${member.vorname} ${member.nachname} wurde erfolgreich zum Event hinzugefügt`,
      anmeldung_id: result.insertId
    });
  } catch (error) {
    console.error('❌ Fehler bei Admin-Event-Anmeldung:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Teilnehmers' });
  }
});

module.exports = router;
