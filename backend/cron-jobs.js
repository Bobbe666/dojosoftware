const cron = require('node-cron');
const db = require('./db');
const logger = require('./utils/logger');
const auditLog = require('./services/auditLogService');
const { pruefeDokumentenAufbewahrung } = require('./services/documentRetentionService');
const { checkBirthdays } = require('./services/birthdayService');
const { processExpiredTrials, sendTrialReminders } = require('./services/featureAccessService');
const handlebars = require('handlebars');
const nodemailer = require('nodemailer');

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

      // Alle offenen Check-Ins vor heute finden und auschecken (inkl. ältere stale Records)
      const query = `
        UPDATE checkins
        SET checkout_time = CONCAT(DATE(checkin_time), ' 23:59:59'),
            auto_checkout = 1,
            status = 'completed'
        WHERE DATE(checkin_time) < CURDATE()
        AND checkout_time IS NULL
        AND status = 'active'
      `;

      db.query(query, [], (error, result) => {
        if (error) {
          logger.error('❌ Auto-Checkout Fehler', {
            error: error.message
          });
          return;
        }

        const affectedRows = result.affectedRows;
        if (affectedRows > 0) {
          logger.success(`✅ Auto-Checkout erfolgreich: ${affectedRows} Mitglieder ausgecheckt`, {
            count: affectedRows
          });
        } else {
          logger.info('ℹ️ Auto-Checkout: Keine offenen Check-Ins aus Vortagen');
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
   * Terminierte Beitragserhöhungen anwenden
   * Läuft täglich um 03:30 Uhr
   * Wendet alle geplanten Erhöhungen an, deren Datum erreicht ist
   */
  cron.schedule('30 3 * * *', async () => {
    try {
      logger.info('💰 Beitragserhöhungs-Cron-Job gestartet');

      // 1. Einstufige Erhöhungen aus vertraege anwenden
      const [result] = await db.promise().query(`
        UPDATE vertraege
        SET monatsbeitrag = neuer_monatsbeitrag,
            neuer_monatsbeitrag = NULL,
            neuer_beitrag_ab = NULL
        WHERE neuer_beitrag_ab IS NOT NULL
          AND neuer_beitrag_ab <= CURDATE()
          AND status = 'aktiv'
          AND neuer_monatsbeitrag IS NOT NULL
      `);
      if (result.affectedRows > 0) {
        logger.success(`✅ Terminierte Beitragserhöhungen angewendet: ${result.affectedRows} Verträge`);
        await auditLog.log({
          req: null,
          aktion: auditLog.AKTION.TARIFERHOEHUNG,
          kategorie: auditLog.KATEGORIE.FINANZEN,
          entityType: 'vertraege',
          beschreibung: `Cron: ${result.affectedRows} terminierte Beitragserhöhungen automatisch angewendet`,
          neueWerte: { betroffene_vertraege: result.affectedRows, quelle: 'cron_03:30' }
        }).catch(e => logger.error('Audit-Log Fehler (Cron)', { error: e.message }));
      } else {
        logger.info('ℹ️ Beitragserhöhungs-Cron: Keine fälligen einstufigen Erhöhungen');
      }

      // 2. Schrittweise Erhöhungen aus vertrag_beitrag_schritte anwenden
      // Guard: Nur Schritte verarbeiten, bei denen alle vorherigen Schritte bereits angewendet wurden
      const [schritte] = await db.promise().query(`
        SELECT s.id, s.mitglied_id, s.schritt_nr, s.neuer_betrag
        FROM vertrag_beitrag_schritte s
        WHERE s.gueltig_ab <= CURDATE()
          AND s.angewendet_am IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM vertrag_beitrag_schritte s2
            WHERE s2.mitglied_id = s.mitglied_id
              AND s2.schritt_nr < s.schritt_nr
              AND s2.angewendet_am IS NULL
          )
        ORDER BY s.mitglied_id, s.schritt_nr
      `);

      let schritteAngewendet = 0;
      for (const s of schritte) {
        const conn = await db.promise().getConnection();
        try {
          await conn.beginTransaction();
          await conn.query(
            `UPDATE vertraege SET monatsbeitrag = ? WHERE mitglied_id = ? AND status = 'aktiv'`,
            [s.neuer_betrag, s.mitglied_id]
          );
          await conn.query(
            `UPDATE vertrag_beitrag_schritte SET angewendet_am = NOW() WHERE id = ?`,
            [s.id]
          );
          await conn.commit();
          schritteAngewendet++;
        } catch (sErr) {
          await conn.rollback();
          logger.error(`❌ Schritt ${s.schritt_nr} für Mitglied ${s.mitglied_id} fehlgeschlagen`, { error: sErr.message });
        } finally {
          conn.release();
        }
      }

      if (schritteAngewendet > 0) {
        logger.success(`✅ Schrittweise Erhöhungen angewendet: ${schritteAngewendet} Schritte`);
        await auditLog.log({
          req: null,
          aktion: auditLog.AKTION.TARIFERHOEHUNG,
          kategorie: auditLog.KATEGORIE.FINANZEN,
          entityType: 'vertrag_beitrag_schritte',
          beschreibung: `Cron: ${schritteAngewendet} schrittweise Beitragserhöhungen automatisch angewendet`,
          neueWerte: { schritte_angewendet: schritteAngewendet, quelle: 'cron_03:30' }
        }).catch(e => logger.error('Audit-Log Fehler (Cron Schritte)', { error: e.message }));
      }
    } catch (error) {
      logger.error('❌ Beitragserhöhungs-Cron-Job Fehler', {
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
   * Feature-Trials: Abgelaufene Trials deaktivieren
   * Läuft täglich um 00:30 Uhr
   * Setzt Status von abgelaufenen Trials auf 'expired' und loggt Zugriffsentzug
   */
  cron.schedule('30 0 * * *', async () => {
    try {
      logger.info('⏱️ Feature-Trials Ablauf-Check Cron-Job gestartet');

      const result = await processExpiredTrials();

      if (result.processed > 0) {
        logger.success(`✅ Feature-Trials Ablauf-Check erfolgreich: ${result.processed} Trials abgelaufen`, {
          processed: result.processed,
          trials: result.trials
        });
      } else {
        logger.info('ℹ️ Feature-Trials Ablauf-Check: Keine abgelaufenen Trials', {
          zeitpunkt: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('❌ Feature-Trials Ablauf-Check Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * Feature-Trials: Erinnerungen senden
   * Läuft täglich um 09:00 Uhr
   * Sendet Erinnerungen an Nutzer deren Trial bald abläuft (7 Tage, 3 Tage, 1 Tag vorher)
   */
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('📧 Feature-Trials Erinnerungs-Cron-Job gestartet');

      const result = await sendTrialReminders();

      if (result.error) {
        logger.error('❌ Feature-Trials Erinnerungen Fehler', { error: result.error });
        return;
      }

      const totalSent = (result.reminders7d || 0) + (result.reminders3d || 0) + (result.reminders1d || 0);

      if (totalSent > 0) {
        logger.success(`✅ Feature-Trials Erinnerungen gesendet: ${totalSent} Benachrichtigungen`, {
          reminders7d: result.reminders7d,
          reminders3d: result.reminders3d,
          reminders1d: result.reminders1d
        });
      } else {
        logger.info('ℹ️ Feature-Trials Erinnerungen: Keine Erinnerungen zu senden', {
          zeitpunkt: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('❌ Feature-Trials Erinnerungs-Cron-Job Fehler', {
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
      await processGeplanterVersand();
    } catch (error) {
      logger.error('❌ Lastschrift/Geplanter-Versand Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * Vorlage-Trigger Cron-Job
   * Läuft täglich um 08:15 Uhr (nach Geburtstags-Check um 08:00)
   * Verarbeitet automatische E-Mail-Trigger (Geburtstag, Zahlungsverzug, etc.)
   */
  cron.schedule('15 8 * * *', async () => {
    try {
      logger.info('🤖 Vorlage-Trigger Cron-Job gestartet');
      await processVorlageTrigger();
    } catch (error) {
      logger.error('❌ Vorlage-Trigger Cron-Job Fehler', {
        error: error.message,
        stack: error.stack
      });
    }
  });

  /**
   * Automatische Beitragsgenerierung
   * Läuft täglich um 04:45 Uhr
   * Erstellt fehlende Beiträge für alle aktiven SEPA-Mitglieder (aktueller + nächster Monat)
   * Respektiert Ruhepausen und Vertragsenden (bei Kündigung nur bis Vertragsende)
   */
  cron.schedule('45 4 * * *', async () => {
    try {
      logger.info('💰 Beitragsgenerierung Cron-Job gestartet');
      const result = await generateMonthlyBeitraege();
      if (result.generated > 0) {
        logger.info(`✅ Beitragsgenerierung: ${result.generated} neue Beiträge erstellt, ${result.skipped} übersprungen (Ruhepause/Ende)`);
      } else {
        logger.info('ℹ️ Beitragsgenerierung: Keine neuen Beiträge nötig');
      }
    } catch (error) {
      logger.error('❌ Beitragsgenerierung Cron-Job Fehler', { error: error.message, stack: error.stack });
    }
  });


  /**
   * Event-Erinnerungen Cron-Job
   * Läuft täglich um 08:30 Uhr
   * Sendet Push-Erinnerungen 7 Tage und 1 Tag vor dem Event
   * an alle angemeldeten (angemeldet/bestaetigt) Mitglieder
   */
  cron.schedule('30 8 * * *', async () => {
    try {
      logger.info('📅 Event-Erinnerungen Cron-Job gestartet');
      const result = await sendEventReminders();
      const total = result.sent7d + result.sent1d;
      if (total > 0) {
        logger.success(`✅ Event-Erinnerungen: ${result.sent7d} (7-Tage) + ${result.sent1d} (1-Tag) gesendet`);
      } else {
        logger.info('ℹ️ Event-Erinnerungen: Keine Erinnerungen fällig');
      }
    } catch (error) {
      logger.error('❌ Event-Erinnerungen Cron-Job Fehler', {
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
        name: 'Feature-Trials Ablauf-Check',
        schedule: '00:30:00 täglich',
        description: 'Deaktiviert abgelaufene Feature-Trials automatisch'
      },
      {
        name: 'Aufbewahrungsfristen-Prüfung',
        schedule: '02:00:00 täglich',
        description: 'Löscht Dokumente/Rechnungen nach 10 Jahren (§ 147 AO)'
      },
      {
        name: 'Beitragserhöhungen anwenden',
        schedule: '03:30:00 täglich',
        description: 'Wendet terminierte Beitragserhöhungen automatisch an'
      },
      {
        name: 'Geburtstags-Check',
        schedule: '08:00:00 täglich',
        description: 'Sendet Geburtstagswünsche an Mitglieder und benachrichtigt Admins'
      },
      {
        name: 'Feature-Trials Erinnerungen',
        schedule: '09:00:00 täglich',
        description: 'Sendet Erinnerungen wenn Trials bald ablaufen (3 Tage, 1 Tag)'
      },
      {
        name: 'Lastschrift-Scheduler',
        schedule: 'Jede Minute',
        description: 'Prüft und führt geplante Lastschriftläufe aus'
      },
      {
        name: 'Beitragsgenerierung',
        schedule: '04:45:00 täglich',
        description: 'Erstellt fehlende Beiträge für alle aktiven SEPA-Mitglieder'
      },
      {
        name: 'Event-Erinnerungen',
        schedule: '08:30:00 täglich',
        description: 'Sendet Push-Erinnerungen 7 Tage und 1 Tag vor Events an Angemeldete'
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

/**
 * Verarbeitet geplante Versand-Einträge (Phase 6)
 * Wird jede Minute aufgerufen
 */
async function processGeplanterVersand() {
  const pool = db.promise();
  try {
    // Prüfen ob Spalten existieren — silent fail wenn nicht
    const [pending] = await pool.query(
      `SELECT vh.*, dv.email_html, dv.email_betreff, dv.name AS vorlage_name_dv, dv.absender_profil_id
       FROM versandhistorie vh
       JOIN dokument_vorlagen dv ON vh.vorlage_id = dv.id
       WHERE vh.status_detail = 'ausstehend' AND vh.geplant_fuer <= NOW()
       LIMIT 10`
    ).catch(() => [[]]);

    if (!pending.length) return;

    logger.info(`📅 Geplanter Versand: ${pending.length} ausstehend`);

    for (const item of pending) {
      try {
        // Sofort als "in Bearbeitung" markieren (verhindert Doppelverarbeitung)
        const [upd] = await pool.query(
          `UPDATE versandhistorie SET status_detail = 'fehler' WHERE id = ? AND status_detail = 'ausstehend'`,
          [item.id]
        );
        if (upd.affectedRows === 0) continue;

        const [[mitglied]] = await pool.query('SELECT * FROM mitglieder WHERE mitglied_id = ?', [item.mitglied_id]);
        if (!mitglied?.email) {
          await pool.query(`UPDATE versandhistorie SET fehler_text = 'Kein Mitglied oder E-Mail' WHERE id = ?`, [item.id]);
          continue;
        }

        // Absender laden
        const [[absender]] = await pool.query(
          'SELECT * FROM absender_profile WHERE id = ? OR dojo_id = ? ORDER BY (id = ?) DESC, typ LIMIT 1',
          [item.absender_profil_id || 0, item.dojo_id, item.absender_profil_id || 0]
        );

        // E-Mail-Einstellungen
        const [[emailSettings]] = await pool.query('SELECT * FROM email_einstellungen WHERE dojo_id = ? LIMIT 1', [item.dojo_id])
          .catch(async () => { const [[s]] = await pool.query('SELECT * FROM email_settings LIMIT 1'); return [[s]]; });
        if (!emailSettings) {
          await pool.query(`UPDATE versandhistorie SET fehler_text = 'Keine E-Mail-Einstellungen' WHERE id = ?`, [item.id]);
          continue;
        }

        const transporter = nodemailer.createTransport({
          host: emailSettings.smtp_host, port: emailSettings.smtp_port,
          secure: emailSettings.smtp_port === 465,
          auth: { user: emailSettings.smtp_user, pass: emailSettings.smtp_password }
        });

        // Platzhalter ersetzen (einfach)
        const daten = {
          vorname: mitglied.vorname || '', nachname: mitglied.nachname || '',
          vollname: [mitglied.vorname, mitglied.nachname].filter(Boolean).join(' '),
          email: mitglied.email, datum: new Date().toLocaleDateString('de-DE'),
          absender_name: absender?.organisation || absender?.name || '',
        };
        let emailHtml = item.email_html || '';
        let betreff = item.email_betreff || item.vorlage_name_dv || '';
        try {
          emailHtml = handlebars.compile(emailHtml, { noEscape: true })(daten);
          betreff = handlebars.compile(betreff, { noEscape: true })(daten);
        } catch {}

        const fromName = absender?.organisation || absender?.name || 'Dojo';
        await transporter.sendMail({
          from: `"${fromName}" <${absender?.email || emailSettings.smtp_user}>`,
          to: mitglied.email, subject: betreff,
          html: emailHtml, text: emailHtml.replace(/<[^>]+>/g, '')
        });

        await pool.query(`UPDATE versandhistorie SET status_detail = 'gesendet' WHERE id = ?`, [item.id]);
        logger.success(`✅ Geplanter Versand gesendet`, { id: item.id, to: mitglied.email });
      } catch (err) {
        await pool.query(`UPDATE versandhistorie SET fehler_text = ? WHERE id = ?`, [err.message.slice(0, 500), item.id]).catch(() => {});
        logger.error(`❌ Geplanter Versand fehlgeschlagen`, { id: item.id, error: err.message });
      }
    }
  } catch (err) {
    if (!err.message?.includes("Unknown column") && !err.message?.includes("doesn't exist")) {
      logger.error('processGeplanterVersand Fehler', { error: err.message });
    }
  }
}

/**
 * Verarbeitet Vorlage-Trigger (Phase 4)
 * Wird täglich um 08:15 Uhr aufgerufen
 */
async function processVorlageTrigger() {
  const pool = db.promise();

  function ersetzePlatzhalterSimple(html, daten) {
    if (!html) return '';
    try { return handlebars.compile(html, { noEscape: true })(daten); }
    catch { return html.replace(/\{\{(\w+)\}\}/g, (_, k) => daten[k] || ''); }
  }

  try {
    const [trigger] = await pool.query(
      `SELECT vt.*, dv.email_html, dv.email_betreff, dv.name AS vorlage_name
       FROM vorlage_trigger vt
       JOIN dokument_vorlagen dv ON vt.vorlage_id = dv.id
       WHERE vt.aktiv = 1`
    ).catch(() => [[]]);

    if (!trigger.length) return;

    const heute = new Date();
    const monat = heute.getMonth() + 1;
    const tag = heute.getDate();

    // Transporter-Cache pro Dojo
    const transporterCache = {};
    async function getTransporter(dojoId) {
      if (transporterCache[dojoId]) return transporterCache[dojoId];
      const [[s]] = await pool.query('SELECT * FROM email_einstellungen WHERE dojo_id = ? LIMIT 1', [dojoId])
        .catch(async () => { const [[r]] = await pool.query('SELECT * FROM email_settings LIMIT 1'); return [[r]]; });
      if (!s) return null;
      const t = nodemailer.createTransport({
        host: s.smtp_host, port: s.smtp_port, secure: s.smtp_port === 465,
        auth: { user: s.smtp_user, pass: s.smtp_password }
      });
      transporterCache[dojoId] = t;
      return t;
    }

    for (const t of trigger) {
      try {
        let mitglieder = [];
        if (t.trigger_typ === 'geburtstag') {
          [mitglieder] = await pool.query(
            `SELECT * FROM mitglieder WHERE dojo_id = ? AND MONTH(geburtsdatum) = ? AND DAY(geburtsdatum) = ? AND email IS NOT NULL AND email != '' AND status = 'aktiv'`,
            [t.dojo_id, monat, tag]
          );
        } else if (t.trigger_typ === 'mitglied_neu') {
          [mitglieder] = await pool.query(
            `SELECT * FROM mitglieder WHERE dojo_id = ? AND DATE(eintrittsdatum) = CURDATE() AND email IS NOT NULL AND email != ''`,
            [t.dojo_id]
          );
        } else if (t.trigger_typ === 'zahlungsverzug_7' || t.trigger_typ === 'zahlungsverzug_14' || t.trigger_typ === 'zahlungsverzug_30') {
          const tage = parseInt(t.trigger_typ.replace('zahlungsverzug_', ''));
          [mitglieder] = await pool.query(
            `SELECT DISTINCT m.* FROM mitglieder m
             JOIN rechnungen r ON r.mitglied_id = m.mitglied_id
             WHERE m.dojo_id = ? AND r.status IN ('offen','ausstehend')
             AND DATEDIFF(CURDATE(), r.faelligkeitsdatum) = ?
             AND m.email IS NOT NULL AND m.email != ''`,
            [t.dojo_id, tage]
          );
        } else if (t.trigger_typ === 'mitgliedschaft_ablauf_30') {
          [mitglieder] = await pool.query(
            `SELECT m.* FROM mitglieder m
             JOIN vertraege v ON v.mitglied_id = m.mitglied_id
             WHERE m.dojo_id = ? AND DATEDIFF(v.vertragsende, CURDATE()) = 30
             AND v.status = 'aktiv' AND m.email IS NOT NULL AND m.email != ''`,
            [t.dojo_id]
          );
        } else if (t.trigger_typ === 'lizenz_ablauf_30') {
          [mitglieder] = await pool.query(
            `SELECT DISTINCT m.* FROM mitglieder m
             JOIN verbandsmitgliedschaften vm ON vm.mitglied_id = m.mitglied_id
             WHERE m.dojo_id = ? AND DATEDIFF(vm.ablaufdatum, CURDATE()) = 30
             AND m.email IS NOT NULL AND m.email != ''`,
            [t.dojo_id]
          );
        }

        if (!mitglieder.length) continue;

        const transporter = await getTransporter(t.dojo_id);
        if (!transporter) {
          logger.warn(`Trigger ${t.trigger_typ}: Kein E-Mail-Transporter für dojo_id=${t.dojo_id}`);
          continue;
        }

        const [[absender]] = await pool.query(
          'SELECT * FROM absender_profile WHERE dojo_id = ? AND aktiv = 1 ORDER BY typ LIMIT 1', [t.dojo_id]
        );
        const fromName = absender?.organisation || absender?.name || 'Dojo';

        let gesendet = 0;
        for (const mitglied of mitglieder) {
          try {
            const daten = {
              anrede: mitglied.anrede || '', vorname: mitglied.vorname || '',
              nachname: mitglied.nachname || '',
              vollname: [mitglied.vorname, mitglied.nachname].filter(Boolean).join(' '),
              mitgliedsnummer: mitglied.mitgliedsnummer || String(mitglied.mitglied_id),
              email: mitglied.email || '',
              geburtstag: mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '',
              datum: new Date().toLocaleDateString('de-DE'),
              absender_name: fromName, absender_inhaber: absender?.inhaber || '',
            };
            const emailHtml = ersetzePlatzhalterSimple(t.email_html, daten);
            const betreff = ersetzePlatzhalterSimple(t.email_betreff, daten) || t.vorlage_name;

            await transporter.sendMail({
              from: `"${fromName}" <${absender?.email || transporter.options?.auth?.user}>`,
              to: mitglied.email, subject: betreff,
              html: emailHtml, text: emailHtml.replace(/<[^>]+>/g, '')
            });

            try {
              await pool.query(
                `INSERT INTO versandhistorie (dojo_id, mitglied_id, vorlage_id, vorlage_name, versand_art, empfaenger_email, empfaenger_name, betreff, status)
                 VALUES (?, ?, ?, ?, 'email', ?, ?, ?, 'gesendet')`,
                [t.dojo_id, mitglied.mitglied_id, t.vorlage_id, t.vorlage_name,
                 mitglied.email, `${mitglied.vorname} ${mitglied.nachname}`.trim(), betreff]
              );
            } catch {}

            gesendet++;
            await new Promise(r => setTimeout(r, 200));
          } catch (err) {
            logger.error(`Trigger ${t.trigger_typ} Send-Fehler`, { mitglied_id: mitglied.mitglied_id, error: err.message });
          }
        }

        if (gesendet > 0) {
          logger.success(`✅ Trigger ${t.trigger_typ}: ${gesendet}/${mitglieder.length} gesendet`, { dojo_id: t.dojo_id });
        }
      } catch (err) {
        logger.error(`Trigger ${t.trigger_typ} Verarbeitung fehlgeschlagen`, { error: err.message });
      }
    }
  } catch (err) {
    logger.error('processVorlageTrigger Fehler', { error: err.message });
  }
}

/**
 * Generiert fehlende Monatsbeiträge für alle aktiven SEPA-Mitglieder.
 * Erstellt Beiträge vom letzten vorhandenen bis zum übernächsten Monat.
 * Respektiert: Vertragsende (bei Kündigung), Ruhepausen, bereits vorhandene Einträge.
 * Kann auch direkt aufgerufen werden (z.B. aus einem Admin-Endpoint).
 */
async function generateMonthlyBeitraege() {
    const pool = db.promise();
    const now = new Date();

    // Generiere bis Ende des nächsten Monats (als Puffer für Lastschriftlauf)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0); // letzter Tag des übernächsten Monats

    // Alle aktiven + gekündigten Verträge mit SEPA-Zahlung laden
    const [vertraege] = await pool.query(`
        SELECT v.id as vertrag_id, v.mitglied_id, v.dojo_id, v.tarif_id,
               COALESCE(v.monatsbeitrag, v.monatlicher_beitrag) as monatsbeitrag,
               v.vertragsende, v.status,
               v.automatische_verlaengerung, v.verlaengerung_monate,
               v.kuendigung_eingegangen,
               v.ruhepause_von, v.ruhepause_bis,
               v.vertragsbeginn,
               m.zahlungsmethode, m.dojo_id as mitglied_dojo_id
        FROM vertraege v
        JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
        WHERE v.status IN ('aktiv', 'gekuendigt')
          AND (m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')
          AND (m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)
    `);

    let generated = 0;
    let skipped = 0;

    for (const v of vertraege) {
        const dojoId = v.dojo_id || v.mitglied_dojo_id;

        // monatsbeitrag aus Tarif nachladen wenn NULL
        if (!v.monatsbeitrag && v.tarif_id) {
            const [[tarif]] = await pool.query(
                `SELECT price_cents FROM tarife WHERE id = ? LIMIT 1`, [v.tarif_id]
            );
            if (tarif?.price_cents) v.monatsbeitrag = tarif.price_cents / 100;
        }
        if (!v.monatsbeitrag) continue; // kein Betrag — überspringen

        // Automatische Vertragsverlängerung: Kündigungsfrist abgelaufen ohne Kündigung
        if (v.automatische_verlaengerung && !v.kuendigung_eingegangen && v.vertragsende) {
            const ende = new Date(v.vertragsende);
            const kuenfristMonate = v.kuendigungsfrist_monate || 3;
            const kuenfristAbgelaufen = new Date(ende);
            kuenfristAbgelaufen.setMonth(kuenfristAbgelaufen.getMonth() - kuenfristMonate);
            // Wenn Kündigungsfrist verstrichen ist → Verlängerung ist fix, Beiträge generieren
            if (now > kuenfristAbgelaufen) {
                const monate = v.verlaengerung_monate || 12;
                const neuesEnde = new Date(ende);
                neuesEnde.setMonth(neuesEnde.getMonth() + monate);
                await pool.query(
                    `UPDATE vertraege SET vertragsende = ? WHERE id = ?`,
                    [neuesEnde.toISOString().split('T')[0], v.vertrag_id]
                );
                v.vertragsende = neuesEnde.toISOString().split('T')[0];
                logger.info(`🔄 Vertrag auto-verlängert (Kündigungsfrist abgelaufen): Mitglied ${v.mitglied_id} bis ${v.vertragsende}`);
            }
        }

        // Letzten vorhandenen Beitrag ermitteln
        const [[lastRow]] = await pool.query(
            `SELECT MAX(zahlungsdatum) as last_date FROM beitraege WHERE mitglied_id = ?`,
            [v.mitglied_id]
        );

        // Startmonat: Monat nach letztem Beitrag, frühestens Vertragsbeginn
        let startDate;
        if (lastRow?.last_date) {
            startDate = new Date(lastRow.last_date);
            startDate.setMonth(startDate.getMonth() + 1);
            startDate.setDate(1);
        } else {
            // Neues Mitglied — ab Vertragsbeginn oder aktuellem Monat
            const begin = v.vertragsbeginn ? new Date(v.vertragsbeginn) : now;
            startDate = new Date(begin.getFullYear(), begin.getMonth(), 1);
        }

        // Monatsweise generieren
        let current = new Date(startDate);
        while (current <= endDate) {
            const currentYear = current.getFullYear();
            const currentMonth = current.getMonth() + 1;

            // Vertragsende bei Kündigung prüfen
            if (v.vertragsende) {
                const ende = new Date(v.vertragsende);
                if (current > ende) break;
            }

            // Ruhepause prüfen — Monat überspringen
            if (v.ruhepause_von && v.ruhepause_bis) {
                const von = new Date(v.ruhepause_von);
                const bis = new Date(v.ruhepause_bis);
                const currentEnd = new Date(currentYear, currentMonth, 0); // letzter Tag des Monats
                if (current <= bis && currentEnd >= von) {
                    current.setMonth(current.getMonth() + 1);
                    skipped++;
                    continue;
                }
            }

            // Prüfen ob Beitrag bereits existiert
            const [[existing]] = await pool.query(
                `SELECT beitrag_id FROM beitraege
                 WHERE mitglied_id = ? AND YEAR(zahlungsdatum) = ? AND MONTH(zahlungsdatum) = ?
                 LIMIT 1`,
                [v.mitglied_id, currentYear, currentMonth]
            );

            if (!existing) {
                const zahlungsDatum = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                await pool.query(
                    `INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
                     VALUES (?, ?, ?, 'SEPA', 0, ?)`,
                    [v.mitglied_id, v.monatsbeitrag, zahlungsDatum, dojoId]
                );
                generated++;
            }

            current.setMonth(current.getMonth() + 1);
        }
    }

    return { generated, skipped };
}


/**
 * Sendet Push-Erinnerungen für Events
 * - 7 Tage vor dem Event (erinnerung_7d_gesendet = 0)
 * - 1 Tag vor dem Event (erinnerung_1d_gesendet = 0)
 */
async function sendEventReminders() {
  const webpush = require('web-push');

  // VAPID konfigurieren
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  let sent7d = 0;
  let sent1d = 0;

  /**
   * Hilfsfunktion: Push-Nachricht an ein Mitglied senden
   * Sucht alle aktiven Push-Subscriptions des Nutzers (via E-Mail) und sendet
   */
  async function pushToMember(email, payload) {
    const subs = await queryAsync(
      `SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions
       WHERE user_id = ? AND is_active = TRUE`,
      [email]
    );
    let sent = false;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          JSON.stringify(payload)
        );
        sent = true;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await queryAsync(
            `UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?`,
            [sub.endpoint]
          );
        }
      }
    }
    return sent;
  }

  // ── 7-Tage-Erinnerung ──────────────────────────────────────────────────────
  const rows7d = await queryAsync(
    `SELECT ea.anmeldung_id, ea.mitglied_id, ea.event_id,
            m.email, m.vorname, m.nachname,
            e.titel, e.datum, e.uhrzeit_beginn, e.ort
     FROM event_anmeldungen ea
     JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
     JOIN events e ON ea.event_id = e.event_id
     WHERE ea.status IN ('angemeldet', 'bestaetigt')
       AND ea.erinnerung_7d_gesendet = 0
       AND e.status NOT IN ('abgesagt', 'abgeschlossen')
       AND DATE(e.datum) = DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
    []
  );

  for (const row of rows7d) {
    const datumFormatted = new Date(row.datum).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const uhrzeitStr = row.uhrzeit_beginn
      ? ' um ' + row.uhrzeit_beginn.slice(0, 5) + ' Uhr'
      : '';
    const ortStr = row.ort ? ` (${row.ort})` : '';

    const payload = {
      title: `📅 Event in 7 Tagen: ${row.titel}`,
      body: `${datumFormatted}${uhrzeitStr}${ortStr}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `event-reminder-7d-${row.event_id}`,
      requireInteraction: false,
      data: { url: `/member/events/${row.event_id}` }
    };

    const ok = await pushToMember(row.email, payload);

    // Immer als gesendet markieren (auch ohne Subscription — verhindert tägliche Re-Versuche)
    await queryAsync(
      `UPDATE event_anmeldungen SET erinnerung_7d_gesendet = 1 WHERE anmeldung_id = ?`,
      [row.anmeldung_id]
    );

    if (ok) sent7d++;
  }

  // ── 1-Tag-Erinnerung ───────────────────────────────────────────────────────
  const rows1d = await queryAsync(
    `SELECT ea.anmeldung_id, ea.mitglied_id, ea.event_id,
            m.email, m.vorname, m.nachname,
            e.titel, e.datum, e.uhrzeit_beginn, e.ort
     FROM event_anmeldungen ea
     JOIN mitglieder m ON ea.mitglied_id = m.mitglied_id
     JOIN events e ON ea.event_id = e.event_id
     WHERE ea.status IN ('angemeldet', 'bestaetigt')
       AND ea.erinnerung_1d_gesendet = 0
       AND e.status NOT IN ('abgesagt', 'abgeschlossen')
       AND DATE(e.datum) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`,
    []
  );

  for (const row of rows1d) {
    const datumFormatted = new Date(row.datum).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const uhrzeitStr = row.uhrzeit_beginn
      ? ' um ' + row.uhrzeit_beginn.slice(0, 5) + ' Uhr'
      : '';
    const ortStr = row.ort ? ` (${row.ort})` : '';

    const payload = {
      title: `⏰ Morgen: ${row.titel}`,
      body: `${datumFormatted}${uhrzeitStr}${ortStr} — vergiss es nicht!`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `event-reminder-1d-${row.event_id}`,
      requireInteraction: false,
      data: { url: `/member/events/${row.event_id}` }
    };

    const ok = await pushToMember(row.email, payload);

    await queryAsync(
      `UPDATE event_anmeldungen SET erinnerung_1d_gesendet = 1 WHERE anmeldung_id = ?`,
      [row.anmeldung_id]
    );

    if (ok) sent1d++;
  }

  return { sent7d, sent1d };
}

module.exports = { initCronJobs, checkAndExecuteScheduledPaymentRuns, generateMonthlyBeitraege };

