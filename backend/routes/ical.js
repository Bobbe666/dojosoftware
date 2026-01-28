// ============================================================================
// iCAL EXPORT - Kalender-Sync für Google, Outlook, Apple Calendar
// Backend/routes/ical.js
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Generiert eine eindeutige UID für iCal-Events
 */
function generateUID(prefix, id) {
  return `${prefix}-${id}@dojo.tda-intl.org`;
}

/**
 * Formatiert ein Datum für iCal (YYYYMMDD)
 */
function formatDateIcal(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Formatiert Datum + Uhrzeit für iCal (YYYYMMDDTHHMMSS)
 */
function formatDateTimeIcal(date, time) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // Zeit parsen (HH:MM:SS oder HH:MM)
  const timeParts = time ? time.split(':') : ['00', '00', '00'];
  const hours = String(timeParts[0] || '00').padStart(2, '0');
  const minutes = String(timeParts[1] || '00').padStart(2, '0');
  const seconds = String(timeParts[2] || '00').padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Escaped Text für iCal (Kommas, Semikolons, Newlines)
 */
function escapeIcalText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Wochentag zu nächstem Datum konvertieren
 */
function getNextWeekday(weekday, referenceDate = new Date()) {
  const days = {
    'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4,
    'Freitag': 5, 'Samstag': 6, 'Sonntag': 0
  };

  const targetDay = days[weekday];
  if (targetDay === undefined) return referenceDate;

  const currentDay = referenceDate.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;

  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + daysUntil);
  return nextDate;
}

/**
 * Generiert iCal-Header
 */
function generateIcalHeader(calendarName) {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Dojo Software//TDA Int'l//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeIcalText(calendarName)}
X-WR-TIMEZONE:Europe/Berlin
BEGIN:VTIMEZONE
TZID:Europe/Berlin
X-LIC-LOCATION:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
`;
}

/**
 * Generiert iCal-Footer
 */
function generateIcalFooter() {
  return 'END:VCALENDAR';
}

/**
 * Generiert ein iCal-Event für einen Stundenplan-Eintrag (wiederkehrend)
 */
function generateScheduleEvent(entry) {
  const nextDate = getNextWeekday(entry.tag);
  const startDateTime = formatDateTimeIcal(nextDate, entry.uhrzeit_start);
  const endDateTime = formatDateTimeIcal(nextDate, entry.uhrzeit_ende);

  // RRULE Wochentag-Mapping
  const rruleDays = {
    'Montag': 'MO', 'Dienstag': 'TU', 'Mittwoch': 'WE', 'Donnerstag': 'TH',
    'Freitag': 'FR', 'Samstag': 'SA', 'Sonntag': 'SU'
  };

  const description = [
    entry.stil ? `Stil: ${entry.stil}` : '',
    entry.trainer_vorname ? `Trainer: ${entry.trainer_vorname} ${entry.trainer_nachname}` : '',
    entry.raumname ? `Raum: ${entry.raumname}` : '',
    entry.standort_name ? `Standort: ${entry.standort_name}` : ''
  ].filter(Boolean).join('\\n');

  return `BEGIN:VEVENT
UID:${generateUID('schedule', entry.id)}
DTSTAMP:${formatDateTimeIcal(new Date(), '00:00:00')}Z
DTSTART;TZID=Europe/Berlin:${startDateTime}
DTEND;TZID=Europe/Berlin:${endDateTime}
RRULE:FREQ=WEEKLY;BYDAY=${rruleDays[entry.tag] || 'MO'}
SUMMARY:${escapeIcalText(entry.kursname || 'Training')}
DESCRIPTION:${escapeIcalText(description)}
LOCATION:${escapeIcalText(entry.standort_name || '')}
CATEGORIES:Training,Dojo
STATUS:CONFIRMED
END:VEVENT
`;
}

/**
 * Generiert ein iCal-Event für ein Event (einmalig)
 */
function generateEventEntry(event) {
  const startDateTime = formatDateTimeIcal(event.datum, event.uhrzeit_beginn || '10:00:00');
  const endDateTime = formatDateTimeIcal(event.datum, event.uhrzeit_ende || '18:00:00');

  const description = [
    event.beschreibung || '',
    event.ort ? `Ort: ${event.ort}` : '',
    event.max_teilnehmer ? `Max. Teilnehmer: ${event.max_teilnehmer}` : '',
    event.preis ? `Preis: ${event.preis} EUR` : ''
  ].filter(Boolean).join('\\n');

  return `BEGIN:VEVENT
UID:${generateUID('event', event.event_id)}
DTSTAMP:${formatDateTimeIcal(new Date(), '00:00:00')}Z
DTSTART;TZID=Europe/Berlin:${startDateTime}
DTEND;TZID=Europe/Berlin:${endDateTime}
SUMMARY:${escapeIcalText(event.titel)}
DESCRIPTION:${escapeIcalText(description)}
LOCATION:${escapeIcalText(event.ort || '')}
CATEGORIES:Event,Dojo
STATUS:${event.status === 'abgesagt' ? 'CANCELLED' : 'CONFIRMED'}
END:VEVENT
`;
}

// ============================================================================
// TOKEN-BASIERTE AUTHENTIFIZIERUNG (für Kalender-Abos)
// ============================================================================

/**
 * Generiert einen sicheren Token für Kalender-Abos
 */
function generateCalendarToken(mitgliedId, dojoId) {
  const data = `${mitgliedId}-${dojoId}-${process.env.JWT_SECRET || 'dojo-secret'}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Validiert einen Kalender-Token
 */
async function validateCalendarToken(token, mitgliedId) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT mitglied_id, dojo_id FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId],
      (err, results) => {
        if (err) return reject(err);
        if (results.length === 0) return resolve(false);

        const expectedToken = generateCalendarToken(mitgliedId, results[0].dojo_id);
        resolve(token === expectedToken);
      }
    );
  });
}

// ============================================================================
// ÖFFENTLICHE ROUTEN (Token-basiert, kein Login erforderlich)
// ============================================================================

/**
 * GET /api/ical/member/:mitgliedId/:token
 * Persönlicher Kalender eines Mitglieds (seine Kurse + angemeldete Events)
 */
router.get('/member/:mitgliedId/:token', async (req, res) => {
  const { mitgliedId, token } = req.params;

  try {
    // Token validieren
    const isValid = await validateCalendarToken(token, mitgliedId);
    if (!isValid) {
      return res.status(403).send('Ungültiger Kalender-Token');
    }

    // Mitglied-Daten laden
    const [memberRows] = await db.promise().query(
      'SELECT m.*, d.dojoname FROM mitglieder m JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?',
      [mitgliedId]
    );

    if (memberRows.length === 0) {
      return res.status(404).send('Mitglied nicht gefunden');
    }

    const member = memberRows[0];

    // Kurse des Mitglieds laden
    const [scheduleRows] = await db.promise().query(`
      SELECT
        s.stundenplan_id AS id,
        s.tag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        k.gruppenname AS kursname,
        k.stil,
        t.vorname AS trainer_vorname,
        t.nachname AS trainer_nachname,
        r.name AS raumname,
        st.name AS standort_name
      FROM stundenplan s
      JOIN kurse k ON s.kurs_id = k.kurs_id
      JOIN kurs_mitglieder km ON k.kurs_id = km.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      LEFT JOIN raeume r ON s.raum_id = r.id
      LEFT JOIN standorte st ON s.standort_id = st.standort_id
      WHERE km.mitglied_id = ?
      ORDER BY FIELD(s.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag')
    `, [mitgliedId]);

    // Angemeldete Events laden
    const [eventRows] = await db.promise().query(`
      SELECT e.*
      FROM events e
      JOIN event_anmeldungen ea ON e.event_id = ea.event_id
      WHERE ea.mitglied_id = ? AND ea.status IN ('angemeldet', 'bestaetigt')
      AND e.datum >= CURDATE()
      ORDER BY e.datum ASC
    `, [mitgliedId]);

    // iCal generieren
    let ical = generateIcalHeader(`${member.vorname} ${member.nachname} - ${member.dojoname}`);

    // Stundenplan-Events hinzufügen
    for (const entry of scheduleRows) {
      ical += generateScheduleEvent(entry);
    }

    // Events hinzufügen
    for (const event of eventRows) {
      ical += generateEventEntry(event);
    }

    ical += generateIcalFooter();

    // Als iCal-Datei senden
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${member.vorname}_${member.nachname}_kalender.ics"`);
    res.send(ical);

  } catch (error) {
    console.error('Fehler beim Generieren des iCal:', error);
    res.status(500).send('Fehler beim Generieren des Kalenders');
  }
});

/**
 * GET /api/ical/dojo/:dojoId/schedule
 * Öffentlicher Stundenplan eines Dojos
 */
router.get('/dojo/:dojoId/schedule', async (req, res) => {
  const { dojoId } = req.params;

  try {
    // Dojo-Daten laden
    const [dojoRows] = await db.promise().query(
      'SELECT * FROM dojo WHERE id = ?',
      [dojoId]
    );

    if (dojoRows.length === 0) {
      return res.status(404).send('Dojo nicht gefunden');
    }

    const dojo = dojoRows[0];

    // Stundenplan laden
    const [scheduleRows] = await db.promise().query(`
      SELECT
        s.stundenplan_id AS id,
        s.tag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        k.gruppenname AS kursname,
        k.stil,
        t.vorname AS trainer_vorname,
        t.nachname AS trainer_nachname,
        r.name AS raumname,
        st.name AS standort_name
      FROM stundenplan s
      JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON k.trainer_id = t.trainer_id
      LEFT JOIN raeume r ON s.raum_id = r.id
      LEFT JOIN standorte st ON s.standort_id = st.standort_id
      WHERE k.dojo_id = ?
      ORDER BY FIELD(s.tag, 'Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag')
    `, [dojoId]);

    // iCal generieren
    let ical = generateIcalHeader(`${dojo.dojoname} - Stundenplan`);

    for (const entry of scheduleRows) {
      ical += generateScheduleEvent(entry);
    }

    ical += generateIcalFooter();

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dojo.dojoname}_stundenplan.ics"`);
    res.send(ical);

  } catch (error) {
    console.error('Fehler beim Generieren des Stundenplan-iCal:', error);
    res.status(500).send('Fehler beim Generieren des Kalenders');
  }
});

/**
 * GET /api/ical/dojo/:dojoId/events
 * Öffentliche Events eines Dojos
 */
router.get('/dojo/:dojoId/events', async (req, res) => {
  const { dojoId } = req.params;

  try {
    // Dojo-Daten laden
    const [dojoRows] = await db.promise().query(
      'SELECT * FROM dojo WHERE id = ?',
      [dojoId]
    );

    if (dojoRows.length === 0) {
      return res.status(404).send('Dojo nicht gefunden');
    }

    const dojo = dojoRows[0];

    // Events laden
    const [eventRows] = await db.promise().query(`
      SELECT * FROM events
      WHERE dojo_id = ? AND status = 'aktiv' AND datum >= CURDATE()
      ORDER BY datum ASC
    `, [dojoId]);

    // iCal generieren
    let ical = generateIcalHeader(`${dojo.dojoname} - Events`);

    for (const event of eventRows) {
      ical += generateEventEntry(event);
    }

    ical += generateIcalFooter();

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dojo.dojoname}_events.ics"`);
    res.send(ical);

  } catch (error) {
    console.error('Fehler beim Generieren des Event-iCal:', error);
    res.status(500).send('Fehler beim Generieren des Kalenders');
  }
});

// ============================================================================
// AUTHENTIFIZIERTE ROUTEN
// ============================================================================

const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/ical/my-token
 * Gibt den persönlichen Kalender-Token zurück
 */
router.get('/my-token', authenticateToken, async (req, res) => {
  try {
    // Mitglied-ID direkt aus JWT-Token
    let mitglied_id = req.user.mitglied_id;
    let dojo_id = req.user.dojo_id;

    // Wenn kein mitglied_id im Token, versuche über E-Mail zu finden
    if (!mitglied_id && req.user.email) {
      const [rows] = await db.promise().query(
        'SELECT mitglied_id, dojo_id FROM mitglieder WHERE email = ?',
        [req.user.email]
      );
      if (rows.length > 0) {
        mitglied_id = rows[0].mitglied_id;
        dojo_id = rows[0].dojo_id;
      }
    }

    // Für Admins: Hole das erste Dojo falls keine mitglied_id
    if (!mitglied_id && req.user.role === 'admin') {
      // Admin bekommt URLs für sein Dojo
      if (!dojo_id) {
        const [dojos] = await db.promise().query('SELECT id FROM dojo LIMIT 1');
        if (dojos.length > 0) {
          dojo_id = dojos[0].id;
        }
      }

      // Generiere einen Admin-Token basierend auf user_id/admin_id
      const adminId = req.user.id || req.user.admin_id || req.user.user_id;
      const token = generateCalendarToken(adminId, dojo_id);

      const baseUrl = process.env.API_BASE_URL || 'https://dojo.tda-intl.org/api';

      return res.json({
        success: true,
        token,
        admin: true,
        dojo_id,
        urls: {
          personal: null, // Admins haben keinen persönlichen Kalender
          dojoSchedule: `${baseUrl}/ical/dojo/${dojo_id}/schedule`,
          dojoEvents: `${baseUrl}/ical/dojo/${dojo_id}/events`
        },
        instructions: {
          google: 'Google Kalender: Einstellungen → Kalender hinzufügen → Per URL',
          outlook: 'Outlook: Kalender → Kalender hinzufügen → Aus dem Internet abonnieren',
          apple: 'Apple Kalender: Ablage → Neues Kalenderabonnement'
        }
      });
    }

    if (!mitglied_id) {
      return res.status(404).json({ error: 'Kein Mitglied zu diesem User gefunden' });
    }

    const token = generateCalendarToken(mitglied_id, dojo_id);

    // Basis-URL
    const baseUrl = process.env.API_BASE_URL || 'https://dojo.tda-intl.org/api';

    res.json({
      success: true,
      token,
      mitglied_id,
      urls: {
        personal: `${baseUrl}/ical/member/${mitglied_id}/${token}`,
        dojoSchedule: `${baseUrl}/ical/dojo/${dojo_id}/schedule`,
        dojoEvents: `${baseUrl}/ical/dojo/${dojo_id}/events`
      },
      instructions: {
        google: 'Google Kalender: Einstellungen → Kalender hinzufügen → Per URL',
        outlook: 'Outlook: Kalender → Kalender hinzufügen → Aus dem Internet abonnieren',
        apple: 'Apple Kalender: Ablage → Neues Kalenderabonnement'
      }
    });

  } catch (error) {
    console.error('Fehler beim Generieren des Kalender-Tokens:', error);
    res.status(500).json({ error: 'Fehler beim Generieren des Tokens' });
  }
});

/**
 * GET /api/ical/admin/member/:mitgliedId/token
 * Admin: Generiert Token für ein Mitglied
 */
router.get('/admin/member/:mitgliedId/token', authenticateToken, async (req, res) => {
  try {
    // Prüfe Admin-Rechte
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Nur Admins können Tokens für andere Mitglieder generieren' });
    }

    const { mitgliedId } = req.params;

    const [rows] = await db.promise().query(
      'SELECT mitglied_id, dojo_id, vorname, nachname FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const { mitglied_id, dojo_id, vorname, nachname } = rows[0];
    const token = generateCalendarToken(mitglied_id, dojo_id);
    const baseUrl = process.env.API_BASE_URL || 'https://dojo.tda-intl.org/api';

    res.json({
      success: true,
      member: { mitglied_id, vorname, nachname },
      token,
      url: `${baseUrl}/ical/member/${mitglied_id}/${token}`
    });

  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Generieren des Tokens' });
  }
});

module.exports = router;
