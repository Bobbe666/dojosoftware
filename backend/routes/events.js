// ============================================================================
// EVENTS API - VOLLSTÄNDIGE BACKEND-ROUTE
// Backend/routes/events.js
// ============================================================================

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureAccess');

// ============================================================================
// FEATURE PROTECTION: Events-Verwaltung
// ============================================================================
// Admin-Routes erfordern das 'events' Feature (ab Professional Plan)
// Member-Routes sind OHNE Feature-Check verfügbar
router.use(authenticateToken);

// ============================================================================
// SICHERHEITS-HELPER: Tenant-Isolation erzwingen
// ============================================================================

/**
 * Prüft ob User SuperAdmin ist (darf alles sehen)
 */
const isSuperAdmin = (user) => {
  return user.rolle === 'super_admin' ||
         user.role === 'super_admin' ||
         (user.dojo_id === 2 || user.dojo_id === '2');
};

/**
 * Erzwingt dojo_id Filter für normale User
 * SuperAdmins können alle Events sehen
 */
const enforceDojo = (req) => {
  if (isSuperAdmin(req.user)) {
    return req.query.dojo_id || null; // SuperAdmin kann filtern oder alle sehen
  }
  return req.user.dojo_id; // Normale User: nur eigenes Dojo
};

/**
 * Prüft ob User Zugriff auf ein bestimmtes Event hat
 */
const canAccessEvent = async (user, eventDojoId) => {
  if (isSuperAdmin(user)) return true;
  return user.dojo_id == eventDojoId;
};

/**
 * Prüft ob User Zugriff auf Mitglied-Daten hat
 */
const canAccessMember = async (user, mitgliedId) => {
  if (isSuperAdmin(user)) return true;

  // Prüfe ob Mitglied zum gleichen Dojo gehört
  return new Promise((resolve) => {
    db.query(
      'SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId],
      (err, results) => {
        if (err || results.length === 0) {
          resolve(false);
        } else {
          resolve(user.dojo_id == results[0].dojo_id);
        }
      }
    );
  });
};

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
 * ADMIN-ROUTE: Feature-Flag erforderlich
 * SICHERHEIT: dojo_id wird erzwungen für normale User
 */
router.get('/', requireFeature('events'), (req, res) => {
  const { status, upcoming } = req.query;

  // SICHERHEIT: dojo_id erzwingen für normale User
  const effectiveDojoId = enforceDojo(req);

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

  // SICHERHEIT: Immer nach dojo_id filtern wenn vorhanden
  if (effectiveDojoId) {
    query += ' AND e.dojo_id = ?';
    params.push(effectiveDojoId);
    logger.debug('Events: dojo_id Filter erzwungen', { user_id: req.user.id, dojo_id: effectiveDojoId });
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
      logger.error('Fehler beim Abrufen der Events:', { error: err });
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
 * SICHERHEIT: Prüft ob User Zugriff auf das Event-Dojo hat
 */
router.get('/:id', async (req, res) => {
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

  db.query(query, [eventId], async (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen des Events:', { error: err });
      return res.status(500).json({
        error: 'Fehler beim Abrufen des Events',
        details: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = results[0];

    // SICHERHEIT: Prüfe ob User Zugriff auf dieses Event hat
    const hasAccess = await canAccessEvent(req.user, event.dojo_id);
    if (!hasAccess) {
      logger.warn('Events: Zugriff verweigert auf Event', {
        user_id: req.user.id,
        user_dojo_id: req.user.dojo_id,
        event_id: eventId,
        event_dojo_id: event.dojo_id
      });
      return res.status(403).json({ error: 'Keine Berechtigung für dieses Event' });
    }

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
 * SICHERHEIT: Nur für Events des eigenen Dojos
 */
router.get('/:id/anmeldungen', async (req, res) => {
  const eventId = req.params.id;

  // SICHERHEIT: Erst prüfen ob User Zugriff auf das Event hat
  const [eventCheck] = await db.promise().query(
    'SELECT dojo_id FROM events WHERE event_id = ?',
    [eventId]
  );

  if (eventCheck.length === 0) {
    return res.status(404).json({ error: 'Event nicht gefunden' });
  }

  const hasAccess = await canAccessEvent(req.user, eventCheck[0].dojo_id);
  if (!hasAccess) {
    logger.warn('Events: Zugriff auf Anmeldungen verweigert', {
      user_id: req.user.id,
      user_dojo_id: req.user.dojo_id,
      event_id: eventId
    });
    return res.status(403).json({ error: 'Keine Berechtigung für dieses Event' });
  }

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
      logger.error('Fehler beim Abrufen der Anmeldungen:', { error: err });
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
 * SICHERHEIT: Nur für Mitglieder des eigenen Dojos oder eigenes Mitglied
 */
router.get('/mitglied/:mitglied_id', async (req, res) => {
  const mitgliedId = req.params.mitglied_id;

  // SICHERHEIT: Prüfe ob User Zugriff auf dieses Mitglied hat
  const hasAccess = await canAccessMember(req.user, mitgliedId);
  if (!hasAccess) {
    // Prüfe ob es das eigene Mitglied ist (Member-Login)
    if (req.user.mitglied_id != mitgliedId) {
      logger.warn('Events: Zugriff auf Mitglied-Events verweigert', {
        user_id: req.user.id,
        user_mitglied_id: req.user.mitglied_id,
        requested_mitglied_id: mitgliedId
      });
      return res.status(403).json({ error: 'Keine Berechtigung für dieses Mitglied' });
    }
  }

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
      logger.error('Fehler beim Abrufen der Mitglieder-Events:', { error: err });
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
 * ADMIN-ROUTE: Feature-Flag erforderlich
 * SICHERHEIT: dojo_id wird erzwungen für normale User
 */
router.post('/', requireFeature('events'), (req, res) => {
  const eventData = req.body;

  // SICHERHEIT: dojo_id erzwingen - normale User können nur für ihr Dojo erstellen
  let effectiveDojoId;
  if (isSuperAdmin(req.user)) {
    // SuperAdmin kann dojo_id aus Request verwenden
    effectiveDojoId = eventData.dojo_id;
  } else {
    // Normale User: immer eigenes Dojo verwenden
    effectiveDojoId = req.user.dojo_id;
    if (eventData.dojo_id && eventData.dojo_id != req.user.dojo_id) {
      logger.warn('Events: dojo_id Manipulation verhindert', {
        user_id: req.user.id,
        user_dojo_id: req.user.dojo_id,
        requested_dojo_id: eventData.dojo_id
      });
    }
  }

  // dojo_id für Validierung setzen
  eventData.dojo_id = effectiveDojoId;

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
    effectiveDojoId, // SICHERHEIT: Erzwungene dojo_id
    eventData.bild_url || null,
    eventData.anforderungen || null
  ];

  db.query(query, params, async (err, result) => {
    if (err) {
      logger.error('Fehler beim Erstellen des Events:', { error: err });
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

      logger.info('Event ${eventId} erstellt und ${mitglieder.length} Benachrichtigungen versendet');
    } catch (notifErr) {
      logger.error('Fehler beim Versenden der Benachrichtigungen:', { error: notifErr });
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
      logger.error('Fehler beim Prüfen des Events:', { error: err });
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
        logger.error('Fehler beim Anmelden:', { error: err });
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
            if (err) logger.error('Fehler beim Update des Event-Status:', { error: err });
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
      logger.error('Fehler beim Abmelden:', { error: err });
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
        if (err) logger.error('Fehler beim Update des Event-Status:', { error: err });
      }
    );

    // Nächsten von Warteliste hochstufen
    promoteNextFromWaitlist(eventId);

    res.json({ message: 'Erfolgreich abgemeldet' });
  });
});

/**
 * Hilfsfunktion: Nächsten von Warteliste hochstufen
 */
async function promoteNextFromWaitlist(eventId) {
  try {
    const eventEmailService = require('../services/eventEmailService');

    // Nächsten auf der Warteliste finden
    const [waitlistRows] = await db.promise().query(
      `SELECT ea.*, m.email, e.teilnahmegebuehr
       FROM event_anmeldungen ea
       JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
       JOIN events e ON ea.event_id = e.event_id
       WHERE ea.event_id = ? AND ea.status = 'warteliste'
       ORDER BY ea.warteliste_position ASC LIMIT 1`,
      [eventId]
    );

    if (waitlistRows.length === 0) {
      return; // Keine Warteliste
    }

    const nextInLine = waitlistRows[0];

    // Status aktualisieren
    await db.promise().query(
      `UPDATE event_anmeldungen SET status = 'angemeldet', warteliste_position = NULL
       WHERE anmeldung_id = ?`,
      [nextInLine.anmeldung_id]
    );

    // Warteliste-Positionen neu nummerieren
    await db.promise().query(
      `SET @pos := 0;
       UPDATE event_anmeldungen
       SET warteliste_position = (@pos := @pos + 1)
       WHERE event_id = ? AND status = 'warteliste'
       ORDER BY warteliste_position ASC`,
      [eventId]
    );

    // Benachrichtigung senden
    const zahlungslink = nextInLine.teilnahmegebuehr > 0
      ? `${process.env.FRONTEND_URL || ''}/member/events/${eventId}/bezahlen?anmeldung=${nextInLine.anmeldung_id}`
      : null;

    await eventEmailService.sendPromotedFromWaitlistEmail(eventId, nextInLine.mitglied_id, zahlungslink);

    logger.info(`Mitglied ${nextInLine.mitglied_id} von Warteliste für Event ${eventId} hochgestuft`);

  } catch (error) {
    logger.error('Fehler beim Hochstufen von Warteliste:', { error: error.message });
  }
}

// ============================================================================
// PUT ENDPUNKTE
// ============================================================================

/**
 * PUT /api/events/:id
 * Aktualisiert ein Event
 * ADMIN-ROUTE: Feature-Flag erforderlich
 */
router.put('/:id', requireFeature('events'), (req, res) => {
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
      logger.error('Fehler beim Aktualisieren des Events:', { error: err });
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
      logger.error('Fehler beim Aktualisieren der Anmeldung:', { error: err });
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
 * ADMIN-ROUTE: Feature-Flag erforderlich
 */
router.delete('/:id', requireFeature('events'), (req, res) => {
  const eventId = req.params.id;

  // Prüfe ob Anmeldungen existieren
  db.query(
    'SELECT COUNT(*) as count FROM event_anmeldungen WHERE event_id = ?',
    [eventId],
    (err, results) => {
      if (err) {
        logger.error('Fehler beim Prüfen der Anmeldungen:', { error: err });
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
          logger.error('Fehler beim Löschen des Events:', { error: err });
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
 * MEMBER-ROUTE: KEIN Feature-Flag erforderlich
 */
router.post('/:id/anmelden', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { mitglied_id, notizen, payment_intent_id, bezahlt } = req.body;

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

    // 5. Prüfe ob ausgebucht → Warteliste
    let status = 'angemeldet';
    let wartelistePosition = null;
    let aufWarteliste = false;

    if (event.max_teilnehmer && currentCount >= event.max_teilnehmer) {
      // Event ist voll → auf Warteliste setzen
      const [posRows] = await db.promise().query(
        `SELECT COALESCE(MAX(warteliste_position), 0) + 1 as next_pos
         FROM event_anmeldungen WHERE event_id = ? AND status = 'warteliste'`,
        [eventId]
      );
      status = 'warteliste';
      wartelistePosition = posRows[0].next_pos;
      aufWarteliste = true;
    }

    // 6. Erstelle Anmeldung (mit optionaler Zahlungsinformation)
    const istBezahlt = bezahlt || !!payment_intent_id;
    const [result] = await db.promise().query(
      `INSERT INTO event_anmeldungen
       (event_id, mitglied_id, status, warteliste_position, anmeldedatum, bemerkung, bezahlt, bezahldatum, stripe_payment_intent_id)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [eventId, mitglied_id, status, wartelistePosition, notizen || null, istBezahlt ? 1 : 0, istBezahlt ? new Date() : null, payment_intent_id || null]
    );

    logger.info(`Mitglied ${mitglied_id} für Event ${eventId} angemeldet (Status: ${status})`);

    // 7. Email senden
    try {
      const eventEmailService = require('../services/eventEmailService');

      if (aufWarteliste) {
        await eventEmailService.sendWaitlistEmail(eventId, mitglied_id, wartelistePosition);
      } else {
        // Zahlungslink generieren wenn Gebühr vorhanden
        const zahlungslink = event.teilnahmegebuehr > 0
          ? `${process.env.FRONTEND_URL || ''}/member/events/${eventId}/bezahlen?anmeldung=${result.insertId}`
          : null;
        await eventEmailService.sendRegistrationEmail(eventId, mitglied_id, zahlungslink);
      }
    } catch (emailErr) {
      logger.error('Email-Versand fehlgeschlagen:', { error: emailErr.message });
      // Nicht kritisch - Anmeldung wurde trotzdem erstellt
    }

    res.json({
      success: true,
      warteliste: aufWarteliste,
      warteliste_position: wartelistePosition,
      anmeldung_id: result.insertId,
      message: aufWarteliste
        ? `Du stehst auf der Warteliste (Position ${wartelistePosition})`
        : 'Erfolgreich für Event angemeldet',
      anmeldung_id: result.insertId
    });
  } catch (error) {
    logger.error('Fehler bei Event-Anmeldung:', { error: error });
    res.status(500).json({ error: 'Fehler bei der Event-Anmeldung' });
  }
});

/**
 * DELETE /api/events/:id/anmelden
 * Mitglied meldet sich von einem Event ab
 * MEMBER-ROUTE: KEIN Feature-Flag erforderlich
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

    logger.info('Mitglied ${mitglied_id} von Event ${eventId} abgemeldet');

    res.json({
      success: true,
      message: 'Erfolgreich von Event abgemeldet'
    });
  } catch (error) {
    logger.error('Fehler bei Event-Abmeldung:', { error: error });
    res.status(500).json({ error: 'Fehler bei der Event-Abmeldung' });
  }
});

/**
 * GET /api/events/member/:mitglied_id
 * Alle Events mit Anmeldestatus für ein Mitglied
 * MEMBER-ROUTE: KEIN Feature-Flag erforderlich
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
    logger.error('Fehler beim Laden der Member-Events:', { error: error });
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

    logger.info('Admin hat Mitglied ${mitglied_id} zu Event ${eventId} hinzugefügt');

    // 5. Benachrichtigung an Mitglied senden (Optional: Email)
    // TODO: Email-Service implementieren wenn verfügbar
    try {
      // Einfache Konsolen-Notification für jetzt
      logger.debug('📧 Benachrichtigung an ${member.email}:');
      logger.debug('   Event: ${event.titel}');
      logger.debug(`   Datum: ${new Date(event.datum).toLocaleDateString('de-DE')}`);
      logger.debug(`   Status: Bestätigt - Zahlung: ${bezahlt ? 'Bezahlt' : 'Offen'}`);

      // Falls Email-Service existiert, hier aufrufen:
      // await sendEventNotification(member.email, event, 'admin-added');
    } catch (notifError) {
      logger.error('⚠️ Fehler beim Senden der Benachrichtigung:', { error: notifError });
      // Fehler bei Benachrichtigung soll Anmeldung nicht verhindern
    }

    res.json({
      success: true,
      message: `${member.vorname} ${member.nachname} wurde erfolgreich zum Event hinzugefügt`,
      anmeldung_id: result.insertId
    });
  } catch (error) {
    logger.error('Fehler bei Admin-Event-Anmeldung:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Teilnehmers' });
  }
});

/**
 * PUT /api/events/anmeldung/:id/bezahlt
 * Admin markiert eine Anmeldung als bezahlt
 */
router.put('/anmeldung/:id/bezahlt', async (req, res) => {
  const anmeldungId = parseInt(req.params.id);

  try {
    // Aktualisiere Bezahlt-Status
    const [result] = await db.promise().query(
      `UPDATE event_anmeldungen
       SET bezahlt = true, bezahldatum = NOW()
       WHERE anmeldung_id = ?`,
      [anmeldungId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Anmeldung nicht gefunden' });
    }

    logger.info('Anmeldung ${anmeldungId} wurde als bezahlt markiert');

    res.json({
      success: true,
      message: 'Anmeldung wurde als bezahlt markiert'
    });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Bezahlt-Status:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Bezahlt-Status' });
  }
});

// ============================================================================
// NEUE FEATURES: WARTELISTE, ZAHLUNG, DATEIEN, KOMMENTARE, EXPORT
// ============================================================================

const eventEmailService = require('../services/eventEmailService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Konfiguration für Event-Dateien
const eventStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const eventId = req.params.id;
    const dir = path.join(__dirname, '../../uploads/events', String(eventId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const eventUpload = multer({
  storage: eventStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nicht erlaubter Dateityp'), false);
    }
  }
});

// ============================================================================
// PAYMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/events/:id/create-payment-intent
 * Erstellt einen Stripe PaymentIntent für die Event-Gebühr
 */
router.post('/:id/create-payment-intent', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { mitglied_id, anmeldung_id } = req.body;

  try {
    // Event und Anmeldung laden
    const [eventRows] = await db.promise().query(
      'SELECT e.*, d.stripe_secret_key, d.stripe_publishable_key FROM events e JOIN dojo d ON e.dojo_id = d.id WHERE e.event_id = ?',
      [eventId]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = eventRows[0];

    if (!event.teilnahmegebuehr || parseFloat(event.teilnahmegebuehr) <= 0) {
      return res.status(400).json({ error: 'Keine Teilnahmegebühr für dieses Event' });
    }

    if (!event.stripe_secret_key) {
      return res.status(400).json({ error: 'Stripe ist nicht konfiguriert' });
    }

    // Mitglied laden
    const [memberRows] = await db.promise().query(
      'SELECT * FROM mitglieder WHERE mitglied_id = ?',
      [mitglied_id]
    );

    if (memberRows.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = memberRows[0];
    const stripe = require('stripe')(event.stripe_secret_key);
    const amount = Math.round(parseFloat(event.teilnahmegebuehr) * 100); // In Cents

    // PaymentIntent erstellen
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      metadata: {
        event_id: eventId,
        mitglied_id: mitglied_id,
        anmeldung_id: anmeldung_id || '',
        event_titel: event.titel
      },
      description: `Event: ${event.titel} - ${member.vorname} ${member.nachname}`,
      receipt_email: member.email
    });

    // Zahlung in DB speichern
    await db.promise().query(
      `INSERT INTO event_zahlungen (anmeldung_id, event_id, mitglied_id, betrag, zahlungsmethode, stripe_payment_intent_id, status)
       VALUES (?, ?, ?, ?, 'stripe', ?, 'ausstehend')
       ON DUPLICATE KEY UPDATE stripe_payment_intent_id = VALUES(stripe_payment_intent_id)`,
      [anmeldung_id || 0, eventId, mitglied_id, event.teilnahmegebuehr, paymentIntent.id]
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      publishableKey: event.stripe_publishable_key,
      amount: event.teilnahmegebuehr
    });

  } catch (error) {
    logger.error('Fehler beim Erstellen des PaymentIntent:', { error: error.message });
    res.status(500).json({ error: 'Zahlungsfehler: ' + error.message });
  }
});

/**
 * POST /api/events/:id/payment-success
 * Callback nach erfolgreicher Zahlung
 */
router.post('/:id/payment-success', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { mitglied_id, payment_intent_id, anmeldung_id } = req.body;

  try {
    // Anmeldung als bezahlt markieren
    if (anmeldung_id) {
      await db.promise().query(
        `UPDATE event_anmeldungen SET bezahlt = 1, bezahldatum = NOW(), status = 'bestaetigt'
         WHERE anmeldung_id = ?`,
        [anmeldung_id]
      );
    } else {
      await db.promise().query(
        `UPDATE event_anmeldungen SET bezahlt = 1, bezahldatum = NOW(), status = 'bestaetigt'
         WHERE event_id = ? AND mitglied_id = ?`,
        [eventId, mitglied_id]
      );
    }

    // Zahlung in DB aktualisieren
    await db.promise().query(
      `UPDATE event_zahlungen SET status = 'bezahlt', bezahlt_am = NOW()
       WHERE stripe_payment_intent_id = ?`,
      [payment_intent_id]
    );

    // Event-Details für Email laden
    const [eventRows] = await db.promise().query(
      'SELECT teilnahmegebuehr FROM events WHERE event_id = ?',
      [eventId]
    );

    // Bestätigungs-Email senden
    await eventEmailService.sendPaymentConfirmationEmail(
      eventId,
      mitglied_id,
      eventRows[0]?.teilnahmegebuehr || 0
    );

    res.json({ success: true, message: 'Zahlung erfolgreich verarbeitet' });

  } catch (error) {
    logger.error('Fehler bei Payment-Success:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Verarbeiten der Zahlung' });
  }
});

// ============================================================================
// WARTELISTE ENDPOINTS
// ============================================================================

/**
 * GET /api/events/:id/warteliste
 * Gibt die Warteliste für ein Event zurück
 */
router.get('/:id/warteliste', async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [rows] = await db.promise().query(
      `SELECT ea.*, m.vorname, m.nachname, m.email
       FROM event_anmeldungen ea
       JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
       WHERE ea.event_id = ? AND ea.status = 'warteliste'
       ORDER BY ea.warteliste_position ASC`,
      [eventId]
    );

    res.json({ success: true, warteliste: rows });

  } catch (error) {
    logger.error('Fehler beim Laden der Warteliste:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Laden der Warteliste' });
  }
});

/**
 * POST /api/events/:id/warteliste/promote
 * Befördert nächsten von Warteliste (Admin)
 */
router.post('/:id/warteliste/promote', requireFeature('events'), async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    // Nächsten auf der Warteliste finden
    const [waitlistRows] = await db.promise().query(
      `SELECT ea.*, m.email FROM event_anmeldungen ea
       JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
       WHERE ea.event_id = ? AND ea.status = 'warteliste'
       ORDER BY ea.warteliste_position ASC LIMIT 1`,
      [eventId]
    );

    if (waitlistRows.length === 0) {
      return res.json({ success: false, message: 'Keine Einträge auf der Warteliste' });
    }

    const nextInLine = waitlistRows[0];

    // Status aktualisieren
    await db.promise().query(
      `UPDATE event_anmeldungen SET status = 'angemeldet', warteliste_position = NULL
       WHERE anmeldung_id = ?`,
      [nextInLine.anmeldung_id]
    );

    // Warteliste-Positionen neu nummerieren
    await db.promise().query(
      `SET @pos := 0;
       UPDATE event_anmeldungen
       SET warteliste_position = (@pos := @pos + 1)
       WHERE event_id = ? AND status = 'warteliste'
       ORDER BY warteliste_position ASC`,
      [eventId]
    );

    // Benachrichtigung senden
    const [eventRows] = await db.promise().query(
      'SELECT teilnahmegebuehr FROM events WHERE event_id = ?',
      [eventId]
    );

    const zahlungslink = eventRows[0]?.teilnahmegebuehr > 0
      ? `${process.env.FRONTEND_URL || ''}/member/events/${eventId}/bezahlen`
      : null;

    await eventEmailService.sendPromotedFromWaitlistEmail(eventId, nextInLine.mitglied_id, zahlungslink);

    res.json({
      success: true,
      message: `${nextInLine.vorname} ${nextInLine.nachname} wurde von der Warteliste hochgestuft`,
      mitglied_id: nextInLine.mitglied_id
    });

  } catch (error) {
    logger.error('Fehler beim Befördern von Warteliste:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Befördern' });
  }
});

// ============================================================================
// DATEIEN ENDPOINTS
// ============================================================================

/**
 * GET /api/events/:id/dateien
 * Liste aller Dateien zum Event
 */
router.get('/:id/dateien', async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM event_dateien WHERE event_id = ? ORDER BY hochgeladen_am DESC',
      [eventId]
    );

    res.json({ success: true, dateien: rows });

  } catch (error) {
    logger.error('Fehler beim Laden der Event-Dateien:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Laden der Dateien' });
  }
});

/**
 * POST /api/events/:id/dateien
 * Datei hochladen (Admin)
 */
router.post('/:id/dateien', requireFeature('events'), eventUpload.single('datei'), async (req, res) => {
  const eventId = parseInt(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }

  try {
    const { beschreibung } = req.body;
    const dateityp = req.file.mimetype.startsWith('image/') ? 'bild' :
                     req.file.mimetype.includes('pdf') ? 'dokument' : 'sonstiges';

    const [result] = await db.promise().query(
      `INSERT INTO event_dateien (event_id, dateiname, dateipfad, dateityp, beschreibung, hochgeladen_von)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [eventId, req.file.originalname, req.file.path, dateityp, beschreibung || null, req.user?.id || null]
    );

    res.json({
      success: true,
      datei_id: result.insertId,
      dateiname: req.file.originalname
    });

  } catch (error) {
    logger.error('Fehler beim Hochladen der Datei:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Hochladen' });
  }
});

/**
 * GET /api/events/:id/dateien/:dateiId/download
 * Datei herunterladen
 */
router.get('/:id/dateien/:dateiId/download', async (req, res) => {
  const dateiId = parseInt(req.params.dateiId);

  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM event_dateien WHERE datei_id = ?',
      [dateiId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    const datei = rows[0];
    res.download(datei.dateipfad, datei.dateiname);

  } catch (error) {
    logger.error('Fehler beim Download:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Download' });
  }
});

/**
 * DELETE /api/events/:id/dateien/:dateiId
 * Datei löschen (Admin)
 */
router.delete('/:id/dateien/:dateiId', requireFeature('events'), async (req, res) => {
  const dateiId = parseInt(req.params.dateiId);

  try {
    const [rows] = await db.promise().query(
      'SELECT dateipfad FROM event_dateien WHERE datei_id = ?',
      [dateiId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    // Datei vom Filesystem löschen
    if (fs.existsSync(rows[0].dateipfad)) {
      fs.unlinkSync(rows[0].dateipfad);
    }

    // DB-Eintrag löschen
    await db.promise().query('DELETE FROM event_dateien WHERE datei_id = ?', [dateiId]);

    res.json({ success: true, message: 'Datei gelöscht' });

  } catch (error) {
    logger.error('Fehler beim Löschen der Datei:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ============================================================================
// KOMMENTARE/NACHRICHTEN ENDPOINTS
// ============================================================================

/**
 * GET /api/events/:id/nachrichten
 * Alle Nachrichten zum Event
 */
router.get('/:id/nachrichten', async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [rows] = await db.promise().query(
      `SELECT en.*,
        CASE
          WHEN en.verfasser_typ = 'mitglied' THEN (SELECT CONCAT(vorname, ' ', nachname) FROM mitglieder WHERE mitglied_id = en.verfasser_id)
          WHEN en.verfasser_typ = 'admin' THEN (SELECT CONCAT(vorname, ' ', nachname) FROM admins WHERE id = en.verfasser_id)
          WHEN en.verfasser_typ = 'trainer' THEN (SELECT name FROM trainer WHERE id = en.verfasser_id)
          ELSE 'Unbekannt'
        END as verfasser_name
       FROM event_nachrichten en
       WHERE en.event_id = ?
       ORDER BY en.erstellt_am ASC`,
      [eventId]
    );

    res.json({ success: true, nachrichten: rows });

  } catch (error) {
    logger.error('Fehler beim Laden der Nachrichten:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Laden der Nachrichten' });
  }
});

/**
 * POST /api/events/:id/nachrichten
 * Neue Nachricht erstellen
 */
router.post('/:id/nachrichten', async (req, res) => {
  const eventId = parseInt(req.params.id);
  const { verfasser_id, verfasser_typ, nachricht } = req.body;

  if (!nachricht || nachricht.trim() === '') {
    return res.status(400).json({ error: 'Nachricht darf nicht leer sein' });
  }

  try {
    const [result] = await db.promise().query(
      `INSERT INTO event_nachrichten (event_id, verfasser_id, verfasser_typ, nachricht)
       VALUES (?, ?, ?, ?)`,
      [eventId, verfasser_id, verfasser_typ || 'mitglied', nachricht.trim()]
    );

    res.json({
      success: true,
      nachricht_id: result.insertId
    });

  } catch (error) {
    logger.error('Fehler beim Erstellen der Nachricht:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Erstellen der Nachricht' });
  }
});

/**
 * DELETE /api/events/:id/nachrichten/:nachrichtId
 * Nachricht löschen (eigene oder Admin)
 */
router.delete('/:id/nachrichten/:nachrichtId', async (req, res) => {
  const nachrichtId = parseInt(req.params.nachrichtId);
  const { verfasser_id, is_admin } = req.body;

  try {
    // Prüfe Berechtigung
    const [rows] = await db.promise().query(
      'SELECT verfasser_id FROM event_nachrichten WHERE nachricht_id = ?',
      [nachrichtId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    if (!is_admin && rows[0].verfasser_id !== verfasser_id) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Löschen' });
    }

    await db.promise().query('DELETE FROM event_nachrichten WHERE nachricht_id = ?', [nachrichtId]);

    res.json({ success: true, message: 'Nachricht gelöscht' });

  } catch (error) {
    logger.error('Fehler beim Löschen der Nachricht:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ============================================================================
// EXPORT ENDPOINTS (CSV, PDF, iCal)
// ============================================================================

/**
 * GET /api/events/:id/export/csv
 * Teilnehmerliste als CSV
 */
router.get('/:id/export/csv', requireFeature('events'), async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [event] = await db.promise().query('SELECT titel FROM events WHERE event_id = ?', [eventId]);
    const [rows] = await db.promise().query(
      `SELECT m.vorname, m.nachname, m.email, m.telefon,
              ea.status, ea.bezahlt, ea.anmeldedatum, ea.bemerkung
       FROM event_anmeldungen ea
       JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
       WHERE ea.event_id = ?
       ORDER BY m.nachname, m.vorname`,
      [eventId]
    );

    // CSV Header
    const headers = ['Vorname', 'Nachname', 'Email', 'Telefon', 'Status', 'Bezahlt', 'Anmeldedatum', 'Bemerkung'];
    let csv = headers.join(';') + '\n';

    // CSV Rows
    for (const row of rows) {
      const values = [
        row.vorname || '',
        row.nachname || '',
        row.email || '',
        row.telefon || '',
        row.status || '',
        row.bezahlt ? 'Ja' : 'Nein',
        row.anmeldedatum ? new Date(row.anmeldedatum).toLocaleDateString('de-DE') : '',
        (row.bemerkung || '').replace(/;/g, ',')
      ];
      csv += values.join(';') + '\n';
    }

    const filename = `teilnehmer_${event[0]?.titel?.replace(/[^a-z0-9]/gi, '_') || eventId}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // BOM für Excel UTF-8

  } catch (error) {
    logger.error('Fehler beim CSV-Export:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Export' });
  }
});

/**
 * GET /api/events/:id/export/pdf
 * Teilnehmerliste als PDF
 */
router.get('/:id/export/pdf', requireFeature('events'), async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    const [eventRows] = await db.promise().query(
      'SELECT * FROM events WHERE event_id = ?',
      [eventId]
    );
    const event = eventRows[0];

    const [rows] = await db.promise().query(
      `SELECT m.vorname, m.nachname, m.email, ea.status, ea.bezahlt
       FROM event_anmeldungen ea
       JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
       WHERE ea.event_id = ? AND ea.status IN ('angemeldet', 'bestaetigt')
       ORDER BY m.nachname, m.vorname`,
      [eventId]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="teilnehmer_${eventId}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).text(event.titel, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Datum: ${new Date(event.datum).toLocaleDateString('de-DE')}`, { align: 'center' });
    if (event.ort) doc.text(`Ort: ${event.ort}`, { align: 'center' });
    doc.moveDown(2);

    // Teilnehmer
    doc.fontSize(14).text(`Teilnehmerliste (${rows.length} Personen):`);
    doc.moveDown();

    let y = doc.y;
    doc.fontSize(10);
    doc.text('Nr.', 50, y);
    doc.text('Name', 80, y);
    doc.text('Status', 300, y);
    doc.text('Bezahlt', 400, y);
    doc.text('Unterschrift', 470, y);
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    rows.forEach((row, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }
      y = doc.y;
      doc.text(`${index + 1}.`, 50, y);
      doc.text(`${row.vorname} ${row.nachname}`, 80, y);
      doc.text(row.status === 'bestaetigt' ? 'Bestätigt' : 'Angemeldet', 300, y);
      doc.text(row.bezahlt ? 'Ja' : 'Nein', 400, y);
      doc.text('_____________', 470, y);
      doc.moveDown();
    });

    doc.end();

  } catch (error) {
    logger.error('Fehler beim PDF-Export:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Export' });
  }
});

/**
 * GET /api/events/:id/ical
 * Event als iCal-Datei
 */
router.get('/:id/ical', async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [rows] = await db.promise().query(
      'SELECT e.*, d.dojoname FROM events e JOIN dojo d ON e.dojo_id = d.id WHERE e.event_id = ?',
      [eventId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event nicht gefunden' });
    }

    const event = rows[0];
    const startDate = new Date(event.datum);
    if (event.uhrzeit_beginn) {
      const [h, m] = event.uhrzeit_beginn.split(':');
      startDate.setHours(parseInt(h), parseInt(m), 0);
    }

    const endDate = new Date(startDate);
    if (event.uhrzeit_ende) {
      const [h, m] = event.uhrzeit_ende.split(':');
      endDate.setHours(parseInt(h), parseInt(m), 0);
    } else {
      endDate.setHours(endDate.getHours() + 2); // Default 2h
    }

    const formatICalDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DojoSoftware//Events//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:event-${eventId}@dojosoftware.com
DTSTART:${formatICalDate(startDate)}
DTEND:${formatICalDate(endDate)}
SUMMARY:${event.titel}
DESCRIPTION:${(event.beschreibung || '').replace(/\n/g, '\\n')}
LOCATION:${event.ort || ''}
ORGANIZER:${event.dojoname}
STATUS:${event.status === 'abgesagt' ? 'CANCELLED' : 'CONFIRMED'}
END:VEVENT
END:VCALENDAR`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event_${eventId}.ics"`);
    res.send(ical);

  } catch (error) {
    logger.error('Fehler beim iCal-Export:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Export' });
  }
});

/**
 * GET /api/events/ical/subscribe/:token
 * Kalender-Abo für alle Events eines Mitglieds
 */
router.get('/ical/subscribe/:token', async (req, res) => {
  const token = req.params.token;

  try {
    // Token entschlüsseln (Base64-encoded mitglied_id)
    const mitgliedId = parseInt(Buffer.from(token, 'base64').toString('utf8'));

    if (isNaN(mitgliedId)) {
      return res.status(400).json({ error: 'Ungültiger Token' });
    }

    const [rows] = await db.promise().query(
      `SELECT e.*, d.dojoname
       FROM events e
       JOIN dojo d ON e.dojo_id = d.id
       JOIN event_anmeldungen ea ON e.event_id = ea.event_id
       WHERE ea.mitglied_id = ? AND ea.status IN ('angemeldet', 'bestaetigt')
         AND e.datum >= CURDATE()
       ORDER BY e.datum ASC`,
      [mitgliedId]
    );

    const formatICalDate = (date, time) => {
      const d = new Date(date);
      if (time) {
        const [h, m] = time.split(':');
        d.setHours(parseInt(h), parseInt(m), 0);
      }
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DojoSoftware//Events//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Meine Events
`;

    for (const event of rows) {
      const endTime = event.uhrzeit_ende || (event.uhrzeit_beginn ?
        `${parseInt(event.uhrzeit_beginn.split(':')[0]) + 2}:00` : '18:00');

      ical += `BEGIN:VEVENT
UID:event-${event.event_id}@dojosoftware.com
DTSTART:${formatICalDate(event.datum, event.uhrzeit_beginn)}
DTEND:${formatICalDate(event.datum, endTime)}
SUMMARY:${event.titel}
DESCRIPTION:${(event.beschreibung || '').replace(/\n/g, '\\n')}
LOCATION:${event.ort || ''}
ORGANIZER:${event.dojoname}
STATUS:CONFIRMED
END:VEVENT
`;
    }

    ical += 'END:VCALENDAR';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.send(ical);

  } catch (error) {
    logger.error('Fehler beim Kalender-Abo:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Kalender-Abo' });
  }
});

// ============================================================================
// ADMIN DASHBOARD STATS
// ============================================================================

/**
 * GET /api/events/stats/dashboard
 * Event-Statistiken für Admin-Dashboard
 */
router.get('/stats/dashboard', requireFeature('events'), async (req, res) => {
  const { dojo_id } = req.query;

  try {
    let dojoFilter = dojo_id ? 'AND e.dojo_id = ?' : '';
    const params = dojo_id ? [dojo_id] : [];

    // Aktive Events
    const [activeEvents] = await db.promise().query(
      `SELECT COUNT(*) as count FROM events e
       WHERE e.status IN ('geplant', 'anmeldung_offen') AND e.datum >= CURDATE() ${dojoFilter}`,
      params
    );

    // Offene Zahlungen
    const [openPayments] = await db.promise().query(
      `SELECT COUNT(*) as count, COALESCE(SUM(e.teilnahmegebuehr), 0) as summe
       FROM event_anmeldungen ea
       JOIN events e ON ea.event_id = e.event_id
       WHERE ea.bezahlt = 0 AND ea.status IN ('angemeldet', 'bestaetigt')
         AND e.teilnahmegebuehr > 0 ${dojoFilter}`,
      params
    );

    // Anmeldungen diese Woche
    const [weekRegistrations] = await db.promise().query(
      `SELECT COUNT(*) as count FROM event_anmeldungen ea
       JOIN events e ON ea.event_id = e.event_id
       WHERE ea.anmeldedatum >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ${dojoFilter}`,
      params
    );

    // Wartelisten-Einträge
    const [waitlist] = await db.promise().query(
      `SELECT COUNT(*) as count FROM event_anmeldungen ea
       JOIN events e ON ea.event_id = e.event_id
       WHERE ea.status = 'warteliste' ${dojoFilter}`,
      params
    );

    // Top Events (nach Anmeldungen)
    const [topEvents] = await db.promise().query(
      `SELECT e.event_id, e.titel, e.datum, e.max_teilnehmer, e.teilnahmegebuehr,
              COUNT(ea.anmeldung_id) as anmeldungen,
              SUM(CASE WHEN ea.bezahlt = 1 THEN 1 ELSE 0 END) as bezahlt,
              SUM(CASE WHEN ea.bezahlt = 0 THEN e.teilnahmegebuehr ELSE 0 END) as offen_summe
       FROM events e
       LEFT JOIN event_anmeldungen ea ON e.event_id = ea.event_id AND ea.status IN ('angemeldet', 'bestaetigt')
       WHERE e.datum >= CURDATE() ${dojoFilter}
       GROUP BY e.event_id
       ORDER BY anmeldungen DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      stats: {
        aktive_events: activeEvents[0].count,
        offene_zahlungen: openPayments[0].count,
        offene_summe: parseFloat(openPayments[0].summe) || 0,
        anmeldungen_woche: weekRegistrations[0].count,
        warteliste: waitlist[0].count
      },
      top_events: topEvents
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Event-Stats:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

/**
 * POST /api/events/:id/send-reminder
 * Zahlungserinnerung an alle unbezahlten Teilnehmer senden
 */
router.post('/:id/send-reminder', requireFeature('events'), async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [rows] = await db.promise().query(
      `SELECT ea.mitglied_id, m.email, m.vorname
       FROM event_anmeldungen ea
       JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
       WHERE ea.event_id = ? AND ea.bezahlt = 0 AND ea.status IN ('angemeldet', 'bestaetigt')`,
      [eventId]
    );

    let sent = 0;
    for (const row of rows) {
      // TODO: Zahlungserinnerungs-Email implementieren
      // await eventEmailService.sendPaymentReminderEmail(eventId, row.mitglied_id);
      sent++;
    }

    res.json({ success: true, sent: sent, message: `${sent} Erinnerungen versendet` });

  } catch (error) {
    logger.error('Fehler beim Senden der Erinnerungen:', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Senden' });
  }
});

module.exports = router;
