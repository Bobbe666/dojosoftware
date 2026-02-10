const cron = require('node-cron');
const db = require('./db');
const logger = require('./utils/logger');
const { pruefeDokumentenAufbewahrung } = require('./services/documentRetentionService');
const { checkBirthdays } = require('./services/birthdayService');

// Helper: Promise-basierte DB-Query
function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

/**
 * Auto-Checkout Cron-Job
 * Läuft täglich um 00:00:01 Uhr
 * Checkt alle Mitglieder aus, die vom Vortag noch eingecheckt sind
 */
function initCronJobs() {
  // Täglich um 00:00:01 Uhr
  cron.schedule('1 0 * * *', async () => {
    try {
      logger.info('🕐 Auto-Checkout Cron-Job gestartet');

      // Datum vom Vortag berechnen
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      // Uhrzeit für Auto-Checkout: 23:59:59 des Vortages
      const autoCheckoutTime = `${yesterdayDate} 23:59:59`;

      // Alle offenen Check-Ins vom Vortag finden und auschecken
      const query = `
        UPDATE checkins
        SET checkout_time = ?,
            auto_checkout = 1,
            status = 'completed'
        WHERE DATE(checkin_time) = ?
        AND checkout_time IS NULL
        AND status = 'active'
      `;

      db.query(query, [autoCheckoutTime, yesterdayDate], (error, result) => {
        if (error) {
          logger.error('❌ Auto-Checkout Fehler', {
            error: error.message,
            date: yesterdayDate
          });
          return;
        }

        const affectedRows = result.affectedRows;
        if (affectedRows > 0) {
          logger.success(`✅ Auto-Checkout erfolgreich: ${affectedRows} Mitglieder ausgecheckt`, {
            date: yesterdayDate,
            checkoutTime: autoCheckoutTime,
            count: affectedRows
          });
        } else {
          logger.info('ℹ️ Auto-Checkout: Keine offenen Check-Ins vom Vortag', {
            date: yesterdayDate
          });
        }
      });

    } catch (error) {
      logger.error('❌ Auto-Checkout Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * Aufbewahrungsfristen-Prüfung Cron-Job
   * Läuft täglich um 02:00 Uhr
   * Löscht automatisch Dokumente und Rechnungen nach Ablauf der 10-Jahres-Frist (§ 147 AO)
   */
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('🗑️ Aufbewahrungsfristen-Prüfung Cron-Job gestartet');

      const result = await pruefeDokumentenAufbewahrung();

      if (result.gesamt.geloescht > 0) {
        logger.success(`✅ Aufbewahrungsfristen-Prüfung erfolgreich: ${result.gesamt.geloescht} Einträge gelöscht`, {
          dokumente: result.dokumente.geloescht,
          rechnungen: result.rechnungen.geloescht,
          fehler: result.gesamt.fehler
        });
      } else {
        logger.info('ℹ️ Aufbewahrungsfristen-Prüfung: Keine abgelaufenen Einträge zum Löschen', {
          zeitpunkt: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('❌ Aufbewahrungsfristen-Prüfung Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * Geburtstags-Check Cron-Job
   * Läuft täglich um 08:00 Uhr
   * Sendet Geburtstagswünsche an Mitglieder und benachrichtigt Admins
   */
  cron.schedule('0 8 * * *', async () => {
    try {
      logger.info('🎂 Geburtstags-Check Cron-Job gestartet');

      const result = await checkBirthdays();

      if (result.success) {
        if (result.notifications > 0) {
          logger.success(`✅ Geburtstags-Check erfolgreich: ${result.notifications} Benachrichtigung(en) gesendet`, {
            birthdays: result.birthdays,
            notifications: result.notifications
          });
        } else {
          logger.info('ℹ️ Geburtstags-Check: Keine Geburtstage heute oder bereits benachrichtigt', {
            birthdays: result.birthdays
          });
        }
      } else {
        logger.error('❌ Geburtstags-Check fehlgeschlagen', {
          error: result.error
        });
      }
    } catch (error) {
      logger.error('❌ Geburtstags-Check Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * Automatische Lastschriftläufe Cron-Job
   * Läuft jede Minute und prüft ob ein Zeitplan ausgeführt werden soll
   * Führt geplante Lastschriftläufe automatisch aus
   */
  cron.schedule('* * * * *', async () => {
    try {
      await checkAndExecuteScheduledPaymentRuns();
    } catch (error) {
      logger.error('❌ Lastschrift-Scheduler Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  logger.info('✅ Cron-Jobs initialisiert', {
    jobs: [
      {
        name: 'Auto-Checkout',
        schedule: '00:00:01 täglich',
        description: 'Checkt Mitglieder vom Vortag automatisch aus'
      },
      {
        name: 'Aufbewahrungsfristen-Prüfung',
        schedule: '02:00:00 täglich',
        description: 'Löscht Dokumente/Rechnungen nach 10 Jahren (§ 147 AO)'
      },
      {
        name: 'Geburtstags-Check',
        schedule: '08:00:00 täglich',
        description: 'Sendet Geburtstagswünsche an Mitglieder und benachrichtigt Admins'
      },
      {
        name: 'Lastschrift-Scheduler',
        schedule: 'Jede Minute',
        description: 'Prüft und führt geplante Lastschriftläufe aus'
      }
    ]
  });
}

/**
 * Prüft und führt geplante Lastschriftläufe aus
 * Wird jede Minute aufgerufen und prüft ob ein Zeitplan fällig ist
 */
async function checkAndExecuteScheduledPaymentRuns() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  try {
    // Finde alle aktiven Zeitpläne für heute + diese Uhrzeit
    // Die letzte Ausführung muss NULL sein oder vor heute liegen
    const query = `
      SELECT z.*, d.dojoname
      FROM lastschrift_zeitplaene z
      JOIN dojo d ON z.dojo_id = d.id
      WHERE z.aktiv = TRUE
        AND z.ausfuehrungstag = ?
        AND HOUR(z.ausfuehrungszeit) = ?
        AND MINUTE(z.ausfuehrungszeit) = ?
        AND (z.letzte_ausfuehrung IS NULL
             OR DATE(z.letzte_ausfuehrung) < CURDATE())
    `;

    const zeitplaene = await queryAsync(query, [currentDay, currentHour, currentMinute]);

    if (zeitplaene.length === 0) {
      return; // Nichts zu tun
    }

    logger.info(`📅 ${zeitplaene.length} Lastschrift-Zeitpläne fällig`, {
      tag: currentDay,
      uhrzeit: `${currentHour}:${String(currentMinute).padStart(2, '0')}`
    });

    // Lade die Ausführungsfunktion aus der Route
    let executeFunction;
    try {
      const lastschriftZeitplaeneRouter = require('./routes/lastschrift-zeitplaene');
      executeFunction = lastschriftZeitplaeneRouter.executeScheduledPaymentRun;
    } catch (routeError) {
      logger.error('❌ Lastschrift-Zeitpläne Route nicht geladen', {
        error: routeError.message
      });
      return;
    }

    // Führe jeden fälligen Zeitplan aus
    for (const zeitplan of zeitplaene) {
      try {
        logger.info(`💳 Starte automatischen Lastschriftlauf: ${zeitplan.name}`, {
          dojo: zeitplan.dojoname,
          typ: zeitplan.typ,
          zeitplan_id: zeitplan.zeitplan_id
        });

        const result = await executeFunction(zeitplan, zeitplan.dojo_id);

        logger.success(`✅ Lastschriftlauf erfolgreich: ${zeitplan.name}`, {
          dojo: zeitplan.dojoname,
          verarbeitet: result.anzahl_verarbeitet,
          erfolgreich: result.anzahl_erfolgreich,
          betrag: result.gesamtbetrag
        });

        // Optional: E-Mail-Benachrichtigung senden
        await sendPaymentRunNotification(zeitplan.dojo_id, zeitplan, result);

      } catch (execError) {
        logger.error(`❌ Lastschriftlauf fehlgeschlagen: ${zeitplan.name}`, {
          dojo: zeitplan.dojoname,
          error: execError.message
        });

        // Auch bei Fehlern Benachrichtigung senden
        await sendPaymentRunNotification(zeitplan.dojo_id, zeitplan, {
          status: 'fehler',
          error: execError.message
        });
      }
    }

  } catch (error) {
    logger.error('❌ Fehler beim Prüfen der Lastschrift-Zeitpläne', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Sendet eine E-Mail-Benachrichtigung nach einem automatischen Lastschriftlauf
 */
async function sendPaymentRunNotification(dojoId, zeitplan, result) {
  try {
    // Lade Dojo-Daten mit Benachrichtigungs-E-Mail
    const dojoQuery = `
      SELECT dojoname, email, lastschrift_benachrichtigung_email
      FROM dojo WHERE id = ?
    `;
    const dojoResults = await queryAsync(dojoQuery, [dojoId]);

    if (dojoResults.length === 0) {
      return;
    }

    const dojo = dojoResults[0];
    const targetEmail = dojo.lastschrift_benachrichtigung_email || dojo.email;

    if (!targetEmail) {
      return;
    }

    // Versuche E-Mail zu senden
    try {
      const emailService = require('./services/emailService');

      const subject = result.status === 'fehler'
        ? `❌ Lastschriftlauf fehlgeschlagen: ${zeitplan.name}`
        : `✅ Lastschriftlauf abgeschlossen: ${zeitplan.name}`;

      const body = result.status === 'fehler'
        ? `Der automatische Lastschriftlauf "${zeitplan.name}" ist fehlgeschlagen.\n\nFehler: ${result.error}\n\nBitte prüfen Sie die Einstellungen im System.`
        : `Der automatische Lastschriftlauf "${zeitplan.name}" wurde erfolgreich ausgeführt.\n\n` +
          `Verarbeitet: ${result.anzahl_verarbeitet} Mitglieder\n` +
          `Erfolgreich: ${result.anzahl_erfolgreich}\n` +
          `Fehlgeschlagen: ${result.anzahl_fehlgeschlagen || 0}\n` +
          `Gesamtbetrag: ${(result.gesamtbetrag || 0).toFixed(2)} €`;

      await emailService.sendEmail({
        to: targetEmail,
        subject: subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });

      logger.info(`📧 Lastschrift-Benachrichtigung gesendet an: ${targetEmail}`);
    } catch (emailError) {
      // E-Mail-Fehler nur loggen, nicht abbrechen
      logger.warn('⚠️ Lastschrift-Benachrichtigung konnte nicht gesendet werden', {
        email: targetEmail,
        error: emailError.message
      });
    }

  } catch (error) {
    logger.error('❌ Fehler beim Senden der Lastschrift-Benachrichtigung', {
      error: error.message
    });
  }
}

module.exports = { initCronJobs, checkAndExecuteScheduledPaymentRuns };
