// Backend/services/emailService.js
// Zentraler E-Mail Service für die Anwendung

const nodemailer = require('nodemailer');
const validator = require('validator');
const db = require('../db');
const logger = require('../utils/logger');

/**
 * Hole E-Mail-Einstellungen aus der Datenbank oder verwende Fallback
 */
const getEmailSettings = async () => {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM notification_settings WHERE id = 1',
      (err, results) => {
        if (err) {
          // Fallback zu Umgebungsvariablen
          resolve({
            email_enabled: !!process.env.EMAIL_USER,
            email_config: JSON.stringify({
              smtp_host: process.env.EMAIL_HOST || 'smtp.alfahosting.de',
              smtp_port: process.env.EMAIL_PORT || 587,
              smtp_secure: false,
              smtp_user: process.env.EMAIL_USER || '',
              smtp_password: process.env.EMAIL_PASS || ''
            }),
            default_from_email: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
            default_from_name: 'Dojo Software'
          });
        } else if (results && results.length > 0) {
          resolve(results[0]);
        } else {
          // Fallback zu Umgebungsvariablen
          resolve({
            email_enabled: !!process.env.EMAIL_USER,
            email_config: JSON.stringify({
              smtp_host: process.env.EMAIL_HOST || 'smtp.alfahosting.de',
              smtp_port: process.env.EMAIL_PORT || 587,
              smtp_secure: false,
              smtp_user: process.env.EMAIL_USER || '',
              smtp_password: process.env.EMAIL_PASS || ''
            }),
            default_from_email: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
            default_from_name: 'Dojo Software'
          });
        }
      }
    );
  });
};

/**
 * Hole E-Mail-Einstellungen für ein spezifisches Dojo (3-Stufen-System)
 * 1. Eigene SMTP-Daten des Dojos
 * 2. TDA-E-Mail-Adresse des Dojos
 * 3. Fallback: Globale/Zentrale E-Mail-Einstellungen
 */
const getEmailSettingsForDojo = async (dojoId) => {
  return new Promise((resolve, reject) => {
    if (!dojoId) {
      // Kein Dojo angegeben - verwende globale Einstellungen
      return getGlobalEmailSettings().then(resolve).catch(reject);
    }

    // Hole Dojo-Daten und E-Mail-Einstellungen aus separater Tabelle
    db.query(
      `SELECT d.email, d.dojoname,
              des.email_mode, des.smtp_host, des.smtp_port, des.smtp_secure,
              des.smtp_user, des.smtp_password, des.tda_email, des.tda_email_password,
              es.smtp_host as global_smtp_host, es.smtp_port as global_smtp_port,
              es.smtp_secure as global_smtp_secure, es.smtp_user as global_smtp_user,
              es.smtp_password as global_smtp_password, es.default_from_email as global_from_email,
              es.default_from_name as global_from_name, es.aktiv as global_aktiv
       FROM dojo d
       LEFT JOIN dojo_email_settings des ON des.dojo_id = d.id
       LEFT JOIN email_settings es ON es.id = 1
       WHERE d.id = ?`,
      [dojoId],
      (err, results) => {
        if (err || !results || results.length === 0) {
          // Fallback zu globalen Einstellungen
          return getGlobalEmailSettings().then(resolve).catch(reject);
        }

        const dojo = results[0];
        const emailMode = dojo.email_mode || 'zentral';

        // Stufe 1: Eigener SMTP
        if (emailMode === 'eigener_smtp' && dojo.smtp_host) {
          resolve({
            email_enabled: true,
            smtp_host: dojo.smtp_host,
            smtp_port: dojo.smtp_port || 587,
            smtp_secure: !!dojo.smtp_secure,
            smtp_user: dojo.smtp_user,
            smtp_password: dojo.smtp_password,
            default_from_email: dojo.email || dojo.smtp_user,
            default_from_name: dojo.dojoname,
            reply_to: dojo.email,
            mode: 'eigener_smtp'
          });
          return;
        }

        // Stufe 2: TDA-E-Mail
        if (emailMode === 'tda_email' && dojo.tda_email) {
          resolve({
            email_enabled: true,
            smtp_host: dojo.global_smtp_host,
            smtp_port: dojo.global_smtp_port || 587,
            smtp_secure: !!dojo.global_smtp_secure,
            smtp_user: dojo.tda_email,
            smtp_password: dojo.tda_email_password,
            default_from_email: dojo.tda_email,
            default_from_name: dojo.dojoname,
            reply_to: dojo.email,
            mode: 'tda_email'
          });
          return;
        }

        // Stufe 3: Zentraler Versand (Fallback)
        if (dojo.global_smtp_host && dojo.global_aktiv) {
          resolve({
            email_enabled: true,
            smtp_host: dojo.global_smtp_host,
            smtp_port: dojo.global_smtp_port || 587,
            smtp_secure: !!dojo.global_smtp_secure,
            smtp_user: dojo.global_smtp_user,
            smtp_password: dojo.global_smtp_password,
            default_from_email: dojo.global_from_email,
            default_from_name: `${dojo.dojoname} via ${dojo.global_from_name || 'DojoSoftware'}`,
            reply_to: dojo.email,
            mode: 'zentral'
          });
          return;
        }

        // Absoluter Fallback zu Environment-Variablen
        resolve({
          email_enabled: !!process.env.EMAIL_USER,
          smtp_host: process.env.EMAIL_HOST || 'smtp.alfahosting.de',
          smtp_port: parseInt(process.env.EMAIL_PORT) || 587,
          smtp_secure: false,
          smtp_user: process.env.EMAIL_USER || '',
          smtp_password: process.env.EMAIL_PASS || '',
          default_from_email: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
          default_from_name: dojo.dojoname || 'Dojo Software',
          reply_to: dojo.email,
          mode: 'environment'
        });
      }
    );
  });
};

/**
 * Hole globale E-Mail-Einstellungen (für Admin-Bereich)
 */
const getGlobalEmailSettings = async () => {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM email_settings WHERE id = 1',
      (err, results) => {
        if (err || !results || results.length === 0 || !results[0].smtp_host) {
          // Fallback zu Umgebungsvariablen
          resolve({
            email_enabled: !!process.env.EMAIL_USER,
            smtp_host: process.env.EMAIL_HOST || 'smtp.alfahosting.de',
            smtp_port: parseInt(process.env.EMAIL_PORT) || 587,
            smtp_secure: false,
            smtp_user: process.env.EMAIL_USER || '',
            smtp_password: process.env.EMAIL_PASS || '',
            default_from_email: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
            default_from_name: 'DojoSoftware',
            mode: 'environment'
          });
        } else {
          const s = results[0];
          resolve({
            email_enabled: !!s.aktiv,
            smtp_host: s.smtp_host,
            smtp_port: s.smtp_port || 587,
            smtp_secure: !!s.smtp_secure,
            smtp_user: s.smtp_user,
            smtp_password: s.smtp_password,
            default_from_email: s.default_from_email,
            default_from_name: s.default_from_name,
            mode: 'global'
          });
        }
      }
    );
  });
};

/**
 * Erstellt einen E-Mail-Transporter für ein spezifisches Dojo
 */
const createEmailTransporterForDojo = async (dojoId) => {
  const settings = await getEmailSettingsForDojo(dojoId);

  if (!settings.email_enabled) {
    logger.info('⚠️ E-Mail-Versand ist deaktiviert für Dojo', { dojoId, mode: settings.mode });
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();
    logger.info('✅ E-Mail-Transporter bereit', { dojoId, mode: settings.mode });
    return { transporter, settings };
  } catch (error) {
    logger.error('❌ E-Mail-Transporter Fehler', { dojoId, error: error.message, mode: settings.mode });
    return null;
  }
};

/**
 * Sendet eine E-Mail für ein spezifisches Dojo (mit Fallback-System)
 */
const sendEmailForDojo = async (options, dojoId) => {
  try {
    if (!options.to || !validator.isEmail(options.to)) {
      throw new Error('Ungültige E-Mail-Adresse');
    }

    if (!options.subject) {
      throw new Error('E-Mail-Betreff erforderlich');
    }

    const safeSubject = options.subject.replace(/[\r\n]/g, '');
    const result = await createEmailTransporterForDojo(dojoId);

    if (!result) {
      throw new Error('E-Mail-Transporter konnte nicht erstellt werden');
    }

    const { transporter, settings } = result;

    const mailOptions = {
      from: `"${settings.default_from_name}" <${settings.default_from_email}>`,
      to: options.to,
      subject: safeSubject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || []
    };

    // Reply-To hinzufügen wenn vorhanden
    if (settings.reply_to) {
      mailOptions.replyTo = settings.reply_to;
    }

    const info = await transporter.sendMail(mailOptions);
    logger.info('✅ E-Mail erfolgreich versendet', { messageId: info.messageId, dojoId, mode: settings.mode });

    return {
      success: true,
      messageId: info.messageId,
      message: 'E-Mail erfolgreich versendet',
      mode: settings.mode
    };
  } catch (error) {
    logger.error('❌ E-Mail-Versand fehlgeschlagen', { error: error.message, dojoId });
    return {
      success: false,
      error: error.message,
      message: 'E-Mail konnte nicht versendet werden'
    };
  }
};

/**
 * Erstellt einen E-Mail-Transporter
 */
const createEmailTransporter = async () => {
  const settings = await getEmailSettings();

  if (!settings.email_enabled) {
    logger.info('⚠️ E-Mail-Versand ist deaktiviert');
    return null;
  }

  try {
    const emailConfig = typeof settings.email_config === 'string'
      ? JSON.parse(settings.email_config)
      : settings.email_config;

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure,
      auth: {
        user: emailConfig.smtp_user,
        pass: emailConfig.smtp_password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verbindung testen
    await transporter.verify();
    logger.info('✅ E-Mail-Transporter bereit');
    return transporter;
  } catch (error) {
    logger.error('❌ E-Mail-Transporter Fehler:', { error: error.message.message, stack: error.message.stack });
    return null;
  }
};

/**
 * Sendet eine E-Mail mit optionalem Anhang
 * @param {Object} options - E-Mail-Optionen
 * @param {string} options.to - Empfänger-E-Mail
 * @param {string} options.subject - Betreff
 * @param {string} options.text - Text-Inhalt
 * @param {string} options.html - HTML-Inhalt
 * @param {Array} options.attachments - Anhänge
 * @returns {Promise<Object>} - Ergebnis des E-Mail-Versands
 */
const sendEmail = async (options) => {
  try {
    // ✅ SECURITY: Email-Validierung (verhindert Email Header Injection)
    if (!options.to || !validator.isEmail(options.to)) {
      throw new Error('Ungültige E-Mail-Adresse');
    }

    // ✅ SECURITY: Subject-Sanitization (verhindert Email Header Injection)
    if (!options.subject) {
      throw new Error('E-Mail-Betreff erforderlich');
    }
    const safeSubject = options.subject.replace(/[\r\n]/g, '');

    const transporter = await createEmailTransporter();

    if (!transporter) {
      throw new Error('E-Mail-Transporter konnte nicht erstellt werden');
    }

    const settings = await getEmailSettings();

    const mailOptions = {
      from: `"${settings.default_from_name}" <${settings.default_from_email}>`,
      to: options.to,
      subject: safeSubject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('✅ E-Mail erfolgreich versendet:', { data: info.messageId });

    return {
      success: true,
      messageId: info.messageId,
      message: 'E-Mail erfolgreich versendet'
    };
  } catch (error) {
    logger.error('❌ E-Mail-Versand fehlgeschlagen:', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message,
      message: 'E-Mail konnte nicht versendet werden'
    };
  }
};

/**
 * Sendet eine Vertrags-E-Mail mit PDF-Anhang
 * @param {Object} data - Daten für die E-Mail
 * @param {string} data.email - Empfänger-E-Mail
 * @param {string} data.vorname - Vorname des Mitglieds
 * @param {string} data.nachname - Nachname des Mitglieds
 * @param {string} data.vertragsnummer - Vertragsnummer
 * @param {Buffer} data.pdfBuffer - PDF als Buffer
 * @param {string} data.dojoname - Name des Dojos
 * @returns {Promise<Object>} - Ergebnis des E-Mail-Versands
 */
const sendVertragEmail = async (data) => {
  const { email, vorname, nachname, vertragsnummer, pdfBuffer, dojoname } = data;

  const subject = `Ihr Mitgliedschaftsvertrag - ${dojoname}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #FFD700; margin: 0;">Willkommen bei ${dojoname}!</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Sehr geehrte/r ${vorname} ${nachname},</p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          vielen Dank für Ihre Anmeldung bei ${dojoname}. Wir freuen uns, Sie als neues Mitglied begrüßen zu dürfen!
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Im Anhang finden Sie Ihre Vertragsunterlagen:
        </p>

        <ul style="font-size: 14px; color: #555; line-height: 1.8;">
          <li>Mitgliedschaftsvertrag (Vertragsnummer: <strong>${vertragsnummer}</strong>)</li>
          <li>Allgemeine Geschäftsbedingungen (AGB)</li>
          <li>Datenschutzerklärung</li>
          <li>Weitere relevante Dokumente</li>
        </ul>

        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #1e40af;">
            <strong>Wichtig:</strong> Bitte bewahren Sie diese Unterlagen sorgfältig auf.
            Sie dienen als Nachweis Ihrer Mitgliedschaft und enthalten wichtige Informationen
            zu Ihren Rechten und Pflichten.
          </p>
        </div>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.
        </p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Mit freundlichen Grüßen<br>
          <strong>Ihr ${dojoname} Team</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht direkt auf diese Nachricht.
        </p>
      </div>
    </div>
  `;

  const text = `
Sehr geehrte/r ${vorname} ${nachname},

vielen Dank für Ihre Anmeldung bei ${dojoname}. Wir freuen uns, Sie als neues Mitglied begrüßen zu dürfen!

Im Anhang finden Sie Ihre Vertragsunterlagen:
- Mitgliedschaftsvertrag (Vertragsnummer: ${vertragsnummer})
- Allgemeine Geschäftsbedingungen (AGB)
- Datenschutzerklärung
- Weitere relevante Dokumente

Bitte bewahren Sie diese Unterlagen sorgfältig auf.

Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr ${dojoname} Team
  `.trim();

  return await sendEmail({
    to: email,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `Vertrag_${vertragsnummer}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
};

/**
 * Sendet eine Badge-Benachrichtigungs-E-Mail
 * @param {Object} data - Daten für die E-Mail
 * @param {string} data.email - Empfänger-E-Mail
 * @param {string} data.vorname - Vorname des Mitglieds
 * @param {string} data.nachname - Nachname des Mitglieds
 * @param {string} data.badgeName - Name des Badges
 * @param {string} data.badgeBeschreibung - Beschreibung des Badges
 * @param {string} data.badgeIcon - Icon des Badges
 * @param {string} data.badgeFarbe - Farbe des Badges
 * @param {string} data.dojoname - Name des Dojos
 * @returns {Promise<Object>} - Ergebnis des E-Mail-Versands
 */
const sendBadgeEmail = async (data) => {
  const { email, vorname, nachname, badgeName, badgeBeschreibung, badgeIcon, badgeFarbe, dojoname } = data;

  // Icon-Emoji-Mapping
  const iconEmojis = {
    award: '🏅',
    star: '⭐',
    trophy: '🏆',
    medal: '🎖️',
    crown: '👑',
    flame: '🔥',
    target: '🎯',
    heart: '❤️',
    users: '👥',
    swords: '⚔️',
    zap: '⚡',
    'trending-up': '📈',
    footprints: '👣',
    layers: '📚',
    brain: '🧠',
    shield: '🛡️'
  };

  const iconEmoji = iconEmojis[badgeIcon] || '🏅';
  const subject = `${iconEmoji} Herzlichen Glückwunsch! Neue Auszeichnung erhalten - ${dojoname || 'Dojo'}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #FFD700; margin: 0;">🎉 Herzlichen Glückwunsch!</h1>
        <p style="color: rgba(255,255,255,0.8); margin-top: 10px;">Du hast eine neue Auszeichnung erhalten!</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hallo ${vorname},</p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          wir freuen uns, dir mitzuteilen, dass du eine neue Auszeichnung erhalten hast!
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, ${badgeFarbe || '#FFD700'}40, ${badgeFarbe || '#FFD700'}20); border: 3px solid ${badgeFarbe || '#FFD700'}; border-radius: 50%; width: 80px; height: 80px; line-height: 80px; font-size: 40px; box-shadow: 0 4px 20px ${badgeFarbe || '#FFD700'}60;">
            ${iconEmoji}
          </div>
          <h2 style="color: ${badgeFarbe || '#FFD700'}; margin: 20px 0 10px 0; font-size: 24px;">${badgeName}</h2>
          ${badgeBeschreibung ? `<p style="font-size: 14px; color: #666; margin: 0;">${badgeBeschreibung}</p>` : ''}
        </div>

        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #1e40af;">
            <strong>Weiter so!</strong> Dein Engagement und deine Fortschritte werden belohnt.
            Besuche dein Profil, um alle deine Auszeichnungen zu sehen.
          </p>
        </div>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Mit sportlichen Grüßen<br>
          <strong>Dein ${dojoname || 'Dojo'} Team</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Diese E-Mail wurde automatisch generiert. Bitte antworte nicht direkt auf diese Nachricht.
        </p>
      </div>
    </div>
  `;

  const text = `
Hallo ${vorname},

wir freuen uns, dir mitzuteilen, dass du eine neue Auszeichnung erhalten hast!

${iconEmoji} ${badgeName}
${badgeBeschreibung || ''}

Weiter so! Dein Engagement und deine Fortschritte werden belohnt.
Besuche dein Profil, um alle deine Auszeichnungen zu sehen.

Mit sportlichen Grüßen
Dein ${dojoname || 'Dojo'} Team
  `.trim();

  return await sendEmail({
    to: email,
    subject,
    text,
    html
  });
};

/**
 * Sendet E-Mail an Dojo-Admin bei neuer Probetraining-Anfrage
 * @param {Object} data - Anfragedaten
 */
const sendProbetrainingAnfrageEmail = async (data) => {
  const { to, dojoName, interessent, kurs, wunschdatum, nachricht } = data;

  const subject = `🥋 Neue Probetraining-Anfrage - ${interessent.vorname} ${interessent.nachname}`;

  const kursInfo = kurs ? `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Gewünschter Kurs:</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${kurs.name}</strong><br>
        <span style="color: #666;">${kurs.wochentag}, ${kurs.start_zeit} - ${kurs.end_zeit}</span>
      </td>
    </tr>
  ` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0;">🥋 Neue Probetraining-Anfrage!</h1>
        <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">${dojoName}</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Es liegt eine neue Probetraining-Anfrage vor:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666; width: 140px;">Name:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${interessent.vorname} ${interessent.nachname}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">E-Mail:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${interessent.email}">${interessent.email}</a></td>
          </tr>
          ${interessent.telefon ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Telefon:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${interessent.telefon}">${interessent.telefon}</a></td>
          </tr>
          ` : ''}
          ${kursInfo}
          ${wunschdatum ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Wunschdatum:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(wunschdatum).toLocaleDateString('de-DE')}</td>
          </tr>
          ` : ''}
        </table>

        ${nachricht ? `
        <div style="background: #f8f9fa; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
          <p style="margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase;">Nachricht:</p>
          <p style="margin: 0; font-size: 14px; color: #333;">${nachricht}</p>
        </div>
        ` : ''}

        <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>⏰ Bitte kontaktieren Sie den Interessenten zeitnah!</strong><br>
            Die Anfrage wurde in der Interessentenliste gespeichert.
          </p>
        </div>

        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
          Diese E-Mail wurde automatisch generiert von DojoSoftware.
        </p>
      </div>
    </div>
  `;

  const text = `
Neue Probetraining-Anfrage bei ${dojoName}

Name: ${interessent.vorname} ${interessent.nachname}
E-Mail: ${interessent.email}
${interessent.telefon ? `Telefon: ${interessent.telefon}` : ''}
${kurs ? `Gewünschter Kurs: ${kurs.name} (${kurs.wochentag}, ${kurs.start_zeit})` : ''}
${wunschdatum ? `Wunschdatum: ${new Date(wunschdatum).toLocaleDateString('de-DE')}` : ''}
${nachricht ? `Nachricht: ${nachricht}` : ''}

Bitte kontaktieren Sie den Interessenten zeitnah!
  `;

  return sendEmail({
    to,
    subject,
    text,
    html
  });
};

/**
 * Sendet Bestätigungs-E-Mail an Interessent nach Probetraining-Anfrage
 * @param {Object} data - Anfragedaten
 */
const sendProbetrainingBestaetigung = async (data) => {
  const { to, vorname, dojoName, kurs, wunschdatum } = data;

  const subject = `✅ Ihre Probetraining-Anfrage bei ${dojoName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #FFD700; margin: 0;">🥋 Vielen Dank für Ihre Anfrage!</h1>
        <p style="color: rgba(255,255,255,0.8); margin-top: 10px;">${dojoName}</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hallo ${vorname},</p>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          vielen Dank für Ihr Interesse an einem Probetraining bei uns!
          Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.
        </p>

        ${kurs ? `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #166534;"><strong>Ihr gewünschter Kurs:</strong></p>
          <p style="margin: 0; font-size: 16px; color: #15803d;">
            ${kurs.name}<br>
            <span style="font-size: 14px; color: #166534;">${kurs.wochentag}, ${kurs.start_zeit} - ${kurs.end_zeit}</span>
          </p>
        </div>
        ` : ''}

        ${wunschdatum ? `
        <p style="font-size: 14px; color: #555;">
          <strong>Ihr Wunschtermin:</strong> ${new Date(wunschdatum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        ` : ''}

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #1e40af;">
            <strong>Was Sie mitbringen sollten:</strong><br>
            • Bequeme Sportkleidung<br>
            • Etwas zu trinken<br>
            • Gute Laune! 😊
          </p>
        </div>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          Wir freuen uns auf Sie!<br><br>
          Mit sportlichen Grüßen<br>
          <strong>Ihr Team von ${dojoName}</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <p style="font-size: 12px; color: #999; text-align: center;">
          Diese E-Mail wurde automatisch versendet.<br>
          Bei Fragen antworten Sie einfach auf diese E-Mail.
        </p>
      </div>
    </div>
  `;

  const text = `
Hallo ${vorname},

vielen Dank für Ihr Interesse an einem Probetraining bei ${dojoName}!
Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.

${kurs ? `Ihr gewünschter Kurs: ${kurs.name} (${kurs.wochentag}, ${kurs.start_zeit})` : ''}
${wunschdatum ? `Ihr Wunschtermin: ${new Date(wunschdatum).toLocaleDateString('de-DE')}` : ''}

Was Sie mitbringen sollten:
- Bequeme Sportkleidung
- Etwas zu trinken
- Gute Laune!

Wir freuen uns auf Sie!

Mit sportlichen Grüßen
Ihr Team von ${dojoName}
  `;

  return sendEmail({
    to,
    subject,
    text,
    html
  });
};

module.exports = {
  sendEmail,
  sendEmailForDojo,
  sendVertragEmail,
  sendBadgeEmail,
  sendProbetrainingAnfrageEmail,
  sendProbetrainingBestaetigung,
  createEmailTransporter,
  createEmailTransporterForDojo,
  getEmailSettings,
  getEmailSettingsForDojo,
  getGlobalEmailSettings
};
