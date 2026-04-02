// ============================================================================
// EVENT EMAIL SERVICE
// Zentraler Service für Event-bezogene E-Mails
// ============================================================================

const db = require('../db');
const logger = require('../utils/logger');
const { sendEmailForDojo } = require('./emailService');

/**
 * Hole ein Email-Template aus der Datenbank
 */
async function getEmailTemplate(templateKey) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM event_email_templates WHERE template_key = ? AND aktiv = 1',
      [templateKey],
      (err, results) => {
        if (err) {
          logger.error('Fehler beim Laden des Email-Templates:', { templateKey, error: err });
          return reject(err);
        }
        resolve(results && results.length > 0 ? results[0] : null);
      }
    );
  });
}

/**
 * Ersetze Template-Variablen
 * Unterstützt einfache {{variable}} und bedingte {{#if var}}...{{/if}} Syntax
 */
function replaceTemplateVariables(template, data) {
  if (!template) return '';

  let result = template;

  // Bedingte Blöcke verarbeiten: {{#if variable}}...{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalRegex, (match, variable, content) => {
    return data[variable] ? content : '';
  });

  // Einfache Variablen ersetzen: {{variable}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(variableRegex, (match, variable) => {
    return data[variable] !== undefined ? data[variable] : '';
  });

  return result;
}

/**
 * Formatiere Datum für Email
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formatiere Uhrzeit für Email
 */
function formatTime(timeStr) {
  if (!timeStr) return '';
  // Wenn timeStr im Format HH:MM:SS ist, kürze auf HH:MM
  return timeStr.substring(0, 5) + ' Uhr';
}

/**
 * Hole Event-Details für Email
 */
async function getEventDetails(eventId) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT e.*, d.dojoname, d.id as dojo_id
       FROM events e
       JOIN dojo d ON e.dojo_id = d.id
       WHERE e.event_id = ?`,
      [eventId],
      (err, results) => {
        if (err) return reject(err);
        resolve(results && results.length > 0 ? results[0] : null);
      }
    );
  });
}

/**
 * Hole Mitglieder-Details für Email
 */
async function getMemberDetails(mitgliedId) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId],
      (err, results) => {
        if (err) return reject(err);
        resolve(results && results.length > 0 ? results[0] : null);
      }
    );
  });
}

/**
 * Hole alle Teilnehmer eines Events
 */
async function getEventParticipants(eventId, statusFilter = null) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT m.*, ea.status as anmeldung_status, ea.anmeldung_id
      FROM event_anmeldungen ea
      JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
      WHERE ea.event_id = ?
    `;
    const params = [eventId];

    if (statusFilter) {
      if (Array.isArray(statusFilter)) {
        query += ` AND ea.status IN (${statusFilter.map(() => '?').join(',')})`;
        params.push(...statusFilter);
      } else {
        query += ' AND ea.status = ?';
        params.push(statusFilter);
      }
    }

    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results || []);
    });
  });
}

// ============================================================================
// HAUPT-EMAIL-FUNKTIONEN
// ============================================================================

/**
 * Sende Event-Anmeldungs-Bestätigung
 */
async function sendRegistrationEmail(eventId, mitgliedId, zahlungslink = null) {
  try {
    const [event, member, template] = await Promise.all([
      getEventDetails(eventId),
      getMemberDetails(mitgliedId),
      getEmailTemplate('event_anmeldung')
    ]);

    if (!event || !member || !template) {
      logger.warn('Event-Email nicht gesendet - fehlende Daten', { eventId, mitgliedId });
      return { success: false, reason: 'missing_data' };
    }

    const data = {
      vorname: member.vorname,
      nachname: member.nachname,
      eventTitel: event.titel,
      datum: formatDate(event.datum),
      uhrzeit: formatTime(event.uhrzeit_beginn),
      ort: event.ort || 'Wird noch bekannt gegeben',
      gebuehr: event.teilnahmegebuehr > 0 ? parseFloat(event.teilnahmegebuehr).toFixed(2) : null,
      zahlungslink: zahlungslink,
      dojoname: event.dojoname
    };

    const subject = replaceTemplateVariables(template.subject, data);
    const html = replaceTemplateVariables(template.html_content, data);
    const text = replaceTemplateVariables(template.text_content, data);

    const result = await sendEmailForDojo({
      to: member.email,
      subject: subject,
      html: html,
      text: text
    }, event.dojo_id);

    logger.info('Event-Anmelde-Email gesendet', { eventId, mitgliedId, email: member.email });
    return { success: true, result };

  } catch (error) {
    logger.error('Fehler beim Senden der Event-Email:', { error: error.message, eventId, mitgliedId });
    return { success: false, error: error.message };
  }
}

/**
 * Sende Zahlungs-Bestätigung
 */
async function sendPaymentConfirmationEmail(eventId, mitgliedId, betrag) {
  try {
    const [event, member, template] = await Promise.all([
      getEventDetails(eventId),
      getMemberDetails(mitgliedId),
      getEmailTemplate('event_bestaetigung')
    ]);

    if (!event || !member || !template) {
      return { success: false, reason: 'missing_data' };
    }

    const data = {
      vorname: member.vorname,
      eventTitel: event.titel,
      datum: formatDate(event.datum),
      uhrzeit: formatTime(event.uhrzeit_beginn),
      ort: event.ort || 'Wird noch bekannt gegeben',
      betrag: parseFloat(betrag).toFixed(2),
      dojoname: event.dojoname
    };

    const subject = replaceTemplateVariables(template.subject, data);
    const html = replaceTemplateVariables(template.html_content, data);
    const text = replaceTemplateVariables(template.text_content, data);

    const result = await sendEmailForDojo({
      to: member.email,
      subject: subject,
      html: html,
      text: text
    }, event.dojo_id);

    logger.info('Zahlungs-Bestätigung gesendet', { eventId, mitgliedId });
    return { success: true, result };

  } catch (error) {
    logger.error('Fehler beim Senden der Zahlungs-Bestätigung:', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sende Event-Änderungs-Benachrichtigung an alle Teilnehmer
 */
async function sendEventChangeNotification(eventId, aenderungen) {
  try {
    const [event, participants, template] = await Promise.all([
      getEventDetails(eventId),
      getEventParticipants(eventId, ['angemeldet', 'bestaetigt']),
      getEmailTemplate('event_aenderung')
    ]);

    if (!event || !template || participants.length === 0) {
      return { success: true, sent: 0, reason: 'no_participants' };
    }

    // Formatiere Änderungen als HTML-Liste
    let aenderungenHtml = '<ul>';
    for (const [key, value] of Object.entries(aenderungen)) {
      const labels = {
        datum: 'Datum',
        uhrzeit_beginn: 'Startzeit',
        uhrzeit_ende: 'Endzeit',
        ort: 'Ort',
        raum_id: 'Raum',
        beschreibung: 'Beschreibung'
      };
      const label = labels[key] || key;
      aenderungenHtml += `<li><strong>${label}:</strong> ${value.alt || '(nicht gesetzt)'} → ${value.neu}</li>`;
    }
    aenderungenHtml += '</ul>';

    let sentCount = 0;
    const errors = [];

    for (const participant of participants) {
      try {
        const data = {
          vorname: participant.vorname,
          eventTitel: event.titel,
          datum: formatDate(event.datum),
          uhrzeit: formatTime(event.uhrzeit_beginn),
          ort: event.ort || 'Wird noch bekannt gegeben',
          aenderungen: aenderungenHtml,
          dojoname: event.dojoname
        };

        const subject = replaceTemplateVariables(template.subject, data);
        const html = replaceTemplateVariables(template.html_content, data);
        const text = replaceTemplateVariables(template.text_content, data);

        await sendEmailForDojo({
          to: participant.email,
          subject: subject,
          html: html,
          text: text
        }, event.dojo_id);

        sentCount++;
      } catch (err) {
        errors.push({ email: participant.email, error: err.message });
      }
    }

    logger.info('Event-Änderungs-Benachrichtigungen gesendet', { eventId, sent: sentCount, errors: errors.length });
    return { success: true, sent: sentCount, errors };

  } catch (error) {
    logger.error('Fehler beim Senden der Änderungs-Benachrichtigungen:', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sende Event-Absage-Benachrichtigung an alle Teilnehmer
 */
async function sendEventCancellationNotification(eventId, grund = null) {
  try {
    const [event, participants, template] = await Promise.all([
      getEventDetails(eventId),
      getEventParticipants(eventId, ['angemeldet', 'bestaetigt', 'warteliste']),
      getEmailTemplate('event_absage')
    ]);

    if (!event || !template || participants.length === 0) {
      return { success: true, sent: 0 };
    }

    let sentCount = 0;

    for (const participant of participants) {
      try {
        const data = {
          vorname: participant.vorname,
          eventTitel: event.titel,
          grund: grund,
          dojoname: event.dojoname
        };

        const subject = replaceTemplateVariables(template.subject, data);
        const html = replaceTemplateVariables(template.html_content, data);
        const text = replaceTemplateVariables(template.text_content, data);

        await sendEmailForDojo({
          to: participant.email,
          subject: subject,
          html: html,
          text: text
        }, event.dojo_id);

        sentCount++;
      } catch (err) {
        logger.error('Email-Fehler bei Absage:', { email: participant.email, error: err.message });
      }
    }

    logger.info('Event-Absage-Benachrichtigungen gesendet', { eventId, sent: sentCount });
    return { success: true, sent: sentCount };

  } catch (error) {
    logger.error('Fehler beim Senden der Absage-Benachrichtigungen:', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sende Event-Erinnerung
 */
async function sendEventReminderEmail(eventId, mitgliedId, tageVorher) {
  try {
    const [event, member, template] = await Promise.all([
      getEventDetails(eventId),
      getMemberDetails(mitgliedId),
      getEmailTemplate('event_erinnerung')
    ]);

    if (!event || !member || !template) {
      return { success: false, reason: 'missing_data' };
    }

    const data = {
      vorname: member.vorname,
      eventTitel: event.titel,
      datum: formatDate(event.datum),
      uhrzeit: formatTime(event.uhrzeit_beginn),
      ort: event.ort || 'Wird noch bekannt gegeben',
      tage: tageVorher,
      anforderungen: event.anforderungen,
      dojoname: event.dojoname
    };

    const subject = replaceTemplateVariables(template.subject, data);
    const html = replaceTemplateVariables(template.html_content, data);
    const text = replaceTemplateVariables(template.text_content, data);

    const result = await sendEmailForDojo({
      to: member.email,
      subject: subject,
      html: html,
      text: text
    }, event.dojo_id);

    // Markiere Erinnerung als gesendet
    await new Promise((resolve) => {
      db.query(
        `UPDATE event_anmeldungen SET erinnerung_gesendet = 1
         WHERE event_id = ? AND mitglied_id = ?`,
        [eventId, mitgliedId],
        () => resolve()
      );
    });

    return { success: true, result };

  } catch (error) {
    logger.error('Fehler beim Senden der Erinnerung:', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sende Warteliste-Benachrichtigung
 */
async function sendWaitlistEmail(eventId, mitgliedId, position) {
  try {
    const [event, member, template] = await Promise.all([
      getEventDetails(eventId),
      getMemberDetails(mitgliedId),
      getEmailTemplate('event_warteliste')
    ]);

    if (!event || !member || !template) {
      return { success: false, reason: 'missing_data' };
    }

    const data = {
      vorname: member.vorname,
      eventTitel: event.titel,
      position: position,
      dojoname: event.dojoname
    };

    const subject = replaceTemplateVariables(template.subject, data);
    const html = replaceTemplateVariables(template.html_content, data);
    const text = replaceTemplateVariables(template.text_content, data);

    const result = await sendEmailForDojo({
      to: member.email,
      subject: subject,
      html: html,
      text: text
    }, event.dojo_id);

    return { success: true, result };

  } catch (error) {
    logger.error('Fehler beim Senden der Warteliste-Email:', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sende "Von Warteliste nachgerückt" Benachrichtigung
 */
async function sendPromotedFromWaitlistEmail(eventId, mitgliedId, zahlungslink = null) {
  try {
    const [event, member, template] = await Promise.all([
      getEventDetails(eventId),
      getMemberDetails(mitgliedId),
      getEmailTemplate('event_von_warteliste')
    ]);

    if (!event || !member || !template) {
      return { success: false, reason: 'missing_data' };
    }

    const data = {
      vorname: member.vorname,
      eventTitel: event.titel,
      datum: formatDate(event.datum),
      uhrzeit: formatTime(event.uhrzeit_beginn),
      ort: event.ort || 'Wird noch bekannt gegeben',
      zahlungslink: zahlungslink,
      dojoname: event.dojoname
    };

    const subject = replaceTemplateVariables(template.subject, data);
    const html = replaceTemplateVariables(template.html_content, data);
    const text = replaceTemplateVariables(template.text_content, data);

    const result = await sendEmailForDojo({
      to: member.email,
      subject: subject,
      html: html,
      text: text
    }, event.dojo_id);

    return { success: true, result };

  } catch (error) {
    logger.error('Fehler beim Senden der Nachrück-Email:', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sende Erinnerungen für alle anstehenden Events (für Cron-Job)
 */
async function sendAllPendingReminders() {
  return new Promise((resolve, reject) => {
    // Finde alle Events, die in X Tagen stattfinden und noch keine Erinnerung gesendet haben
    const query = `
      SELECT e.event_id, e.titel, e.erinnerung_tage,
             ea.mitglied_id, ea.erinnerung_gesendet,
             DATEDIFF(e.datum, CURDATE()) as tage_bis_event
      FROM events e
      JOIN event_anmeldungen ea ON e.event_id = ea.event_id
      WHERE ea.status IN ('angemeldet', 'bestaetigt')
        AND ea.erinnerung_gesendet = 0
        AND e.status IN ('anmeldung_offen', 'ausgebucht')
        AND DATEDIFF(e.datum, CURDATE()) = e.erinnerung_tage
    `;

    db.query(query, async (err, results) => {
      if (err) {
        logger.error('Fehler beim Abrufen der Erinnerungen:', { error: err });
        return reject(err);
      }

      let sentCount = 0;
      for (const row of results || []) {
        try {
          await sendEventReminderEmail(row.event_id, row.mitglied_id, row.tage_bis_event);
          sentCount++;
        } catch (err) {
          logger.error('Erinnerung fehlgeschlagen:', { eventId: row.event_id, mitgliedId: row.mitglied_id });
        }
      }

      logger.info('Event-Erinnerungen verarbeitet', { sent: sentCount, total: results?.length || 0 });
      resolve({ sent: sentCount, total: results?.length || 0 });
    });
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  sendRegistrationEmail,
  sendPaymentConfirmationEmail,
  sendEventChangeNotification,
  sendEventCancellationNotification,
  sendEventReminderEmail,
  sendWaitlistEmail,
  sendPromotedFromWaitlistEmail,
  sendAllPendingReminders,
  getEmailTemplate,
  replaceTemplateVariables
};
