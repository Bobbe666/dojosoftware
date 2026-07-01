// Backend/services/emailService.js
// Zentraler E-Mail Service für die Anwendung

const nodemailer = require('nodemailer');
const validator = require('validator');
const db = require('../db');
const logger = require('../utils/logger');
const { decrypt, isEncrypted } = require('../utils/encryption');
const { renderEmail, getDojoMailTheme } = require('./emailLayout');

/**
 * SECURITY: Entschlüsselt Passwort wenn nötig
 */
const decryptPassword = (password) => {
  if (!password) return password;
  try {
    if (isEncrypted(password)) {
      return decrypt(password);
    }
  } catch (error) {
    logger.warn('Passwort-Entschlüsselung fehlgeschlagen, verwende Originalwert');
  }
  return password;
};

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
            email_enabled: !!(process.env.EMAIL_USER || process.env.SMTP_USER),
            email_config: JSON.stringify({
              smtp_host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.alfahosting.de',
              smtp_port: process.env.EMAIL_PORT || 587,
              smtp_secure: false,
              smtp_user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
              smtp_password: process.env.EMAIL_PASS || process.env.SMTP_PASS || ''
            }),
            default_from_email: process.env.EMAIL_FROM || 'noreply@dojosoftware.com',
            default_from_name: 'Dojo Software'
          });
        } else if (results && results.length > 0) {
          resolve(results[0]);
        } else {
          // Fallback zu Umgebungsvariablen
          resolve({
            email_enabled: !!(process.env.EMAIL_USER || process.env.SMTP_USER),
            email_config: JSON.stringify({
              smtp_host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.alfahosting.de',
              smtp_port: process.env.EMAIL_PORT || 587,
              smtp_secure: false,
              smtp_user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
              smtp_password: process.env.EMAIL_PASS || process.env.SMTP_PASS || ''
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
            smtp_password: decryptPassword(dojo.smtp_password),  // SECURITY: Entschlüsseln
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
            smtp_password: decryptPassword(dojo.tda_email_password),  // SECURITY: Entschlüsseln
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
            smtp_password: decryptPassword(dojo.global_smtp_password),  // SECURITY: Entschlüsseln
            default_from_email: dojo.global_from_email,
            default_from_name: `${dojo.dojoname} via ${dojo.global_from_name || 'DojoSoftware'}`,
            reply_to: dojo.email,
            mode: 'zentral'
          });
          return;
        }

        // Absoluter Fallback zu Environment-Variablen
        resolve({
          email_enabled: !!(process.env.EMAIL_USER || process.env.SMTP_USER),
          smtp_host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.alfahosting.de',
          smtp_port: parseInt(process.env.EMAIL_PORT) || 587,
          smtp_secure: false,
          smtp_user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
          smtp_password: process.env.EMAIL_PASS || process.env.SMTP_PASS || '',
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
            email_enabled: !!(process.env.EMAIL_USER || process.env.SMTP_USER),
            smtp_host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.alfahosting.de',
            smtp_port: parseInt(process.env.EMAIL_PORT) || 587,
            smtp_secure: false,
            smtp_user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
            smtp_password: process.env.EMAIL_PASS || process.env.SMTP_PASS || '',
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
            smtp_password: decryptPassword(s.smtp_password),  // SECURITY: Entschlüsseln
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

    if (options.replyTo) mailOptions.replyTo = options.replyTo;
    if (options.bcc)     mailOptions.bcc     = options.bcc;

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

  const theme = await getDojoMailTheme({ dojoname });
  const html = renderEmail({
    theme, anlass: 'begruessung', titel: dojoname, subtitel: 'Ihr Mitgliedschaftsvertrag',
    bodyHtml: `
      <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Sehr geehrte/r ${vorname} ${nachname},</p>
      <p style="margin:0 0 14px;">vielen Dank für Ihre Anmeldung bei <strong>${dojoname}</strong>. Wir freuen uns, Sie als neues Mitglied begrüßen zu dürfen!</p>
      <p style="margin:0 0 8px;">Im Anhang finden Sie Ihre Vertragsunterlagen:</p>
      <ul style="margin:0 0 14px;padding-left:20px;line-height:1.8;">
        <li>Mitgliedschaftsvertrag (Vertragsnummer: <strong>${vertragsnummer}</strong>)</li>
        <li>Allgemeine Geschäftsbedingungen (AGB)</li>
        <li>Datenschutzerklärung</li>
        <li>Weitere relevante Dokumente</li>
      </ul>
      <div class="box"><p><strong>Wichtig:</strong> Bitte bewahren Sie diese Unterlagen sorgfältig auf. Sie dienen als Nachweis Ihrer Mitgliedschaft und enthalten wichtige Informationen zu Ihren Rechten und Pflichten.</p></div>
      <p style="margin:14px 0 0;">Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.</p>
      <p style="margin:14px 0 0;">Mit freundlichen Grüßen<br><strong>Ihr ${dojoname} Team</strong></p>`,
  });

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

  const theme = await getDojoMailTheme({ dojoname });
  const badgeColor = badgeFarbe || theme.accent || '#FFD700';
  const html = renderEmail({
    theme, anlass: 'allgemein', titel: dojoname || 'Dojo', subtitel: '🎉 Neue Auszeichnung erhalten!',
    bodyHtml: `
      <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${vorname},</p>
      <p style="margin:0;">wir freuen uns, dir mitzuteilen, dass du eine neue Auszeichnung erhalten hast!</p>
      <div style="text-align:center;margin:26px 0;">
        <div style="display:inline-block;background:${badgeColor}22;border:3px solid ${badgeColor};border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;">${iconEmoji}</div>
        <h2 style="color:${badgeColor};margin:18px 0 8px;font-size:23px;">${badgeName}</h2>
        ${badgeBeschreibung ? `<p style="font-size:14px;color:#64748b;margin:0;">${badgeBeschreibung}</p>` : ''}
      </div>
      <div class="box"><p><strong>Weiter so!</strong> Dein Engagement und deine Fortschritte werden belohnt. Besuche dein Profil, um alle deine Auszeichnungen zu sehen.</p></div>
      <p style="margin:14px 0 0;">Mit sportlichen Grüßen<br><strong>Dein ${dojoname || 'Dojo'} Team</strong></p>`,
  });

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

  const theme = await getDojoMailTheme({ dojoname: dojoName });
  const td = 'padding:8px;border-bottom:1px solid #eef2f7;';
  const tdl = td + 'color:#64748b;width:140px;';
  const html = renderEmail({
    theme, anlass: 'allgemein', titel: dojoName, subtitel: '🥋 Neue Probetraining-Anfrage',
    footerNote: 'Automatisch generiert vom TDA Dojo-Verwaltungssystem.',
    bodyHtml: `
      <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Es liegt eine neue Probetraining-Anfrage vor:</p>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin:14px 0;">
        <tr><td style="${tdl}">Name:</td><td style="${td}"><strong>${interessent.vorname} ${interessent.nachname}</strong></td></tr>
        <tr><td style="${tdl}">E-Mail:</td><td style="${td}"><a href="mailto:${interessent.email}">${interessent.email}</a></td></tr>
        ${interessent.telefon ? `<tr><td style="${tdl}">Telefon:</td><td style="${td}"><a href="tel:${interessent.telefon}">${interessent.telefon}</a></td></tr>` : ''}
        ${kursInfo}
        ${wunschdatum ? `<tr><td style="${tdl}">Wunschdatum:</td><td style="${td}">${new Date(wunschdatum).toLocaleDateString('de-DE')}</td></tr>` : ''}
      </table>
      ${nachricht ? `<div class="box"><p style="margin:0 0 5px;font-size:12px;color:#64748b;text-transform:uppercase;">Nachricht:</p><p style="margin:0;">${nachricht}</p></div>` : ''}
      <div style="background:#fef3c7;border-radius:8px;padding:14px 16px;margin:18px 0;"><p style="margin:0;font-size:14px;color:#92400e;"><strong>⏰ Bitte kontaktieren Sie den Interessenten zeitnah!</strong><br>Die Anfrage wurde in der Interessentenliste gespeichert.</p></div>`,
  });

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
  const { to, vorname, dojoName, dojoId, kurs, wunschdatum, buchungsUrl, terminvorschlaege = [] } = data;

  const subject = `✅ Ihre Probetraining-Anfrage bei ${dojoName}`;

  const theme = await getDojoMailTheme(dojoId ? { dojoId } : { dojoname: dojoName });
  const fmtLang = (dstr) => new Date(dstr).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  const vorschlaegeHtml = (buchungsUrl && terminvorschlaege.length)
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 20px;margin:18px 0;">
         <p style="margin:0 0 10px;font-size:14px;color:#166534;"><strong>📅 Sichern Sie sich direkt Ihren Wunschtermin${kurs ? ` – ${kurs.name}` : ''}:</strong></p>
         ${terminvorschlaege.map(t => `<p style="margin:4px 0;font-size:15px;color:#15803d;">• ${fmtLang(t.datum)}${t.uhrzeit ? ` um ${t.uhrzeit} Uhr` : ''}</p>`).join('')}
         <p style="margin:12px 0 0;font-size:13px;color:#166534;">Klicken Sie unten, um Ihren Termin in wenigen Sekunden verbindlich zu buchen.</p>
       </div>`
    : (kurs ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 20px;margin:18px 0;"><p style="margin:0 0 8px;font-size:14px;color:#166534;"><strong>Ihr gewünschter Kurs:</strong></p><p style="margin:0;font-size:16px;color:#15803d;">${kurs.name}<br><span style="font-size:14px;color:#166534;">${kurs.wochentag}, ${kurs.start_zeit} - ${kurs.end_zeit}</span></p></div>` : '');

  const html = renderEmail({
    theme, anlass: 'begruessung', titel: dojoName, subtitel: '🥋 Vielen Dank für Ihre Anfrage!',
    footerNote: 'Bei Fragen antworten Sie einfach auf diese E-Mail.',
    cta: buchungsUrl ? { url: buchungsUrl, label: '📅 Termin verbindlich buchen' } : undefined,
    bodyHtml: `
      <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${vorname},</p>
      <p style="margin:0;">vielen Dank für Ihr Interesse an einem Probetraining bei uns! Wir haben Ihre Anfrage erhalten.</p>
      ${vorschlaegeHtml}
      ${!buchungsUrl && wunschdatum ? `<p style="margin:14px 0 0;"><strong>Ihr Wunschtermin:</strong> ${new Date(wunschdatum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
      <div class="box"><p><strong>Was Sie mitbringen sollten:</strong><br>• Bequeme Sportkleidung<br>• Etwas zu trinken<br>• Gute Laune! 😊</p></div>
      <p style="margin:14px 0 0;">Wir freuen uns auf Sie!<br><br>Mit sportlichen Grüßen<br><strong>Ihr Team von ${dojoName}</strong></p>`,
  });

  const text = `
Hallo ${vorname},

vielen Dank für Ihr Interesse an einem Probetraining bei ${dojoName}!
Wir haben Ihre Anfrage erhalten.

${(buchungsUrl && terminvorschlaege.length) ? `Sichern Sie sich direkt Ihren Wunschtermin${kurs ? ` (${kurs.name})` : ''}:\n${terminvorschlaege.map(t => `- ${fmtLang(t.datum)}${t.uhrzeit ? ` um ${t.uhrzeit} Uhr` : ''}`).join('\n')}\n\nJetzt buchen: ${buchungsUrl}` : (kurs ? `Ihr gewünschter Kurs: ${kurs.name} (${kurs.wochentag}, ${kurs.start_zeit})` : '')}
${!buchungsUrl && wunschdatum ? `Ihr Wunschtermin: ${new Date(wunschdatum).toLocaleDateString('de-DE')}` : ''}

Was Sie mitbringen sollten:
- Bequeme Sportkleidung
- Etwas zu trinken
- Gute Laune!

Wir freuen uns auf Sie!

Mit sportlichen Grüßen
Ihr Team von ${dojoName}
  `;

  return sendEmail({ to, subject, text, html });
};

/**
 * Finale Terminbestätigung, nachdem der Kunde selbst einen Probetraining-Termin gebucht hat.
 */
const sendProbetrainingTerminBestaetigung = async (data) => {
  const { to, vorname, dojoName, dojoId, datum, uhrzeit, kurs, stil, trainer } = data;
  const datumLang = new Date(datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const subject = `🥋 Dein Probetraining bei ${dojoName} ist gebucht – ${datumLang}`;

  const theme = await getDojoMailTheme(dojoId ? { dojoId } : { dojoname: dojoName });
  const dtd  = 'padding:5px 0;color:#475569;width:40%;';
  const dtdv = 'padding:5px 0;font-weight:bold;color:#1e293b;';
  const html = renderEmail({
    theme, anlass: 'begruessung', titel: dojoName, subtitel: '🥋 Probetraining bestätigt!',
    footerNote: 'Solltest du doch nicht können, antworte einfach auf diese E-Mail.',
    bodyHtml: `
      <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${vorname},</p>
      <p style="margin:0;">super – dein Probetraining ist verbindlich gebucht. Wir freuen uns riesig auf dich! 🎉</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 20px;margin:18px 0;">
        <p style="margin:0 0 10px;font-size:14px;color:#166534;"><strong>Dein Termin:</strong></p>
        <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse;">
          <tr><td style="${dtd}">Datum:</td><td style="${dtdv}">${datumLang}</td></tr>
          ${uhrzeit ? `<tr><td style="${dtd}">Uhrzeit:</td><td style="${dtdv}">${uhrzeit} Uhr</td></tr>` : ''}
          ${kurs ? `<tr><td style="${dtd}">Kurs:</td><td style="${dtdv}">${kurs}${stil ? ` (${stil})` : ''}</td></tr>` : ''}
          ${trainer && trainer.trim() ? `<tr><td style="${dtd}">Trainer:</td><td style="padding:5px 0;color:#334155;">${trainer}</td></tr>` : ''}
        </table>
      </div>
      <div class="box"><p><strong>Was du mitbringen solltest:</strong><br>• Bequeme Sportkleidung<br>• Etwas zu trinken<br>• Gute Laune! 😊</p></div>
      <p style="margin:14px 0 0;">Bis bald auf der Matte!<br><br>Mit sportlichen Grüßen<br><strong>Dein Team von ${dojoName}</strong></p>`,
  });

  const text = `Hallo ${vorname},

super – dein Probetraining ist verbindlich gebucht!

Dein Termin:
- Datum: ${datumLang}
${uhrzeit ? `- Uhrzeit: ${uhrzeit} Uhr\n` : ''}${kurs ? `- Kurs: ${kurs}${stil ? ` (${stil})` : ''}\n` : ''}${trainer && trainer.trim() ? `- Trainer: ${trainer}\n` : ''}

Was du mitbringen solltest:
- Bequeme Sportkleidung
- Etwas zu trinken
- Gute Laune!

Bis bald auf der Matte!
Dein Team von ${dojoName}`;

  return sendEmail({ to, subject, text, html });
};

/**
 * Sendet Bestätigungs-E-Mail an Anmelder nach Prüfungsanmeldung
 * @param {Object} anmeldung - Anmeldedaten
 * @param {Object} termin - Prüfungstermin-Details
 */
const sendPruefungsAnmeldungBestaetigung = async (anmeldung, termin) => {
  const { vorname, nachname, email, aktueller_gurt, angestrebter_gurt, verein } = anmeldung;
  const pruefungsdatum = termin.pruefungsdatum
    ? new Date(termin.pruefungsdatum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unbekannt';

  const subject = `✅ Prüfungsanmeldung bestätigt – ${termin.stil_name} am ${pruefungsdatum}`;

  const theme = await getDojoMailTheme({ dojoname: termin.dojoname });
  const dtd  = 'padding:4px 0;color:#475569;width:45%;';
  const dtdv = 'padding:4px 0;font-weight:bold;color:#1e293b;';
  const html = renderEmail({
    theme, anlass: 'allgemein', titel: termin.dojoname, subtitel: '🥋 Prüfungsanmeldung bestätigt',
    footerNote: 'Bei Fragen antworten Sie einfach auf diese E-Mail.',
    bodyHtml: `
      <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${vorname} ${nachname},</p>
      <p style="margin:0;">Ihre Anmeldung zur Prüfung wurde erfolgreich registriert. Wir freuen uns, Sie zu diesem Termin begrüßen zu dürfen.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 20px;margin:18px 0;">
        <p style="margin:0 0 10px;font-size:14px;color:#166534;"><strong>Ihre Prüfungsdetails:</strong></p>
        <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse;">
          <tr><td style="${dtd}">Kampfkunst-Stil:</td><td style="${dtdv}">${termin.stil_name}</td></tr>
          <tr><td style="${dtd}">Datum:</td><td style="${dtdv}">${pruefungsdatum}</td></tr>
          ${termin.pruefungszeit ? `<tr><td style="${dtd}">Uhrzeit:</td><td style="${dtdv}">${termin.pruefungszeit} Uhr</td></tr>` : ''}
          ${termin.pruefungsort ? `<tr><td style="${dtd}">Ort:</td><td style="${dtdv}">${termin.pruefungsort}</td></tr>` : ''}
          ${aktueller_gurt ? `<tr><td style="${dtd}">Aktueller Gurt:</td><td style="padding:4px 0;">${aktueller_gurt}</td></tr>` : ''}
          ${angestrebter_gurt ? `<tr><td style="${dtd}">Angestrebter Gurt:</td><td style="padding:4px 0;">${angestrebter_gurt}</td></tr>` : ''}
          ${verein ? `<tr><td style="${dtd}">Verein/Dojo:</td><td style="padding:4px 0;">${verein}</td></tr>` : ''}
          ${termin.pruefungsgebuehr ? `<tr><td style="${dtd}">Prüfungsgebühr:</td><td style="${dtdv}">${termin.pruefungsgebuehr} €</td></tr>` : ''}
        </table>
      </div>
      ${termin.teilnahmebedingungen ? `<div class="box"><p style="margin:0 0 8px;font-size:14px;color:#1e40af;"><strong>Teilnahmebedingungen:</strong></p><p style="margin:0;font-size:13px;color:#1e40af;white-space:pre-line;">${termin.teilnahmebedingungen}</p></div>` : ''}
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:18px;margin:18px 0;">
        <p style="margin:0 0 8px;font-size:14px;color:#92400e;"><strong>📋 Wichtiger Hinweis zur Stornierung</strong></p>
        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">
          Wir freuen uns sehr auf deine Prüfung und wünschen dir schon jetzt ganz viel Erfolg! 🎉<br><br>
          Solltest du deinen Termin nicht wahrnehmen können, bitten wir dich, dich so früh wie möglich abzumelden.<br><br>
          <strong>Eine kostenfreie Abmeldung ist bis 7 Tage vor der Prüfung möglich.</strong><br><br>
          Ab diesem Zeitpunkt laufen alle Vorbereitungen auf Hochtouren — Urkunde, Prüferplanung und Organisation. Dieser Aufwand ist bereits entstanden, daher bleibt die Prüfungsgebühr bei einer Abmeldung innerhalb dieser Frist in voller Höhe fällig – auch im Krankheitsfall.<br><br>
          Wir bitten herzlich um dein Verständnis und freuen uns darauf, dich am Prüfungstag zu sehen! 🥋
        </p>
      </div>
      <p style="margin:14px 0 0;">Bei Fragen wende dich gerne direkt an ${termin.dojoname}.<br><br>Wir drücken dir die Daumen – du schaffst das!<br><br>Mit sportlichen Grüßen<br><strong>${termin.dojoname}</strong></p>`,
  });

  const text = `
Hallo ${vorname} ${nachname},

Deine Prüfungsanmeldung wurde erfolgreich registriert. Wir freuen uns auf dich!

Prüfungsdetails:
- Stil: ${termin.stil_name}
- Datum: ${pruefungsdatum}
${termin.pruefungszeit ? `- Uhrzeit: ${termin.pruefungszeit} Uhr\n` : ''}${termin.pruefungsort ? `- Ort: ${termin.pruefungsort}\n` : ''}${termin.pruefungsgebuehr ? `- Gebühr: ${termin.pruefungsgebuehr} €\n` : ''}

---
WICHTIGER HINWEIS ZUR STORNIERUNG

Eine kostenfreie Abmeldung ist bis 7 Tage vor der Prüfung möglich.

Ab diesem Zeitpunkt sind alle Vorbereitungen bereits angelaufen (Urkundendruck, Prüferplanung, Organisation). Die Prüfungsgebühr bleibt bei einer späteren Abmeldung in voller Höhe fällig – auch im Krankheitsfall.

Wir bitten herzlich um dein Verständnis.
---

Wir drücken dir die Daumen – du schaffst das! 🥋

Mit sportlichen Grüßen
${termin.dojoname}
  `;

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Sendet Admin-Benachrichtigung bei neuer externer Prüfungsanmeldung
 * @param {Object} anmeldung - Anmeldedaten
 * @param {Object} termin - Prüfungstermin-Details
 */
const sendPruefungsAnmeldungAdminNotification = async (anmeldung, termin) => {
  const { vorname, nachname, email, telefon, verein, aktueller_gurt, angestrebter_gurt, bemerkungen } = anmeldung;
  const pruefungsdatum = termin.pruefungsdatum
    ? new Date(termin.pruefungsdatum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unbekannt';

  const subject = `🥋 Neue externe Prüfungsanmeldung: ${vorname} ${nachname}`;

  const theme = await getDojoMailTheme({ dojoname: termin.dojoname });
  const atd = 'padding:5px 0;color:#475569;width:45%;';
  const html = renderEmail({
    theme, anlass: 'allgemein', titel: termin.dojoname, subtitel: '🥋 Neue Prüfungsanmeldung',
    footerNote: 'Automatisch versendet durch das TDA Dojo-Verwaltungssystem.',
    bodyHtml: `
      <p style="font-size:15px;color:#1e293b;margin:0 0 14px;">Es gibt eine neue externe Anmeldung für Ihre Prüfung:</p>
      <div style="background:#fef9e7;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:14px;color:#92400e;"><strong>Prüfungstermin:</strong></p>
        <p style="margin:0;font-size:15px;color:#78350f;font-weight:bold;">${termin.stil_name} – ${pruefungsdatum}${termin.pruefungsort ? ` | ${termin.pruefungsort}` : ''}</p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin:16px 0;">
        <p style="margin:0 0 10px;font-size:14px;color:#475569;"><strong>Angaben des Teilnehmers:</strong></p>
        <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse;">
          <tr><td style="${atd}">Name:</td><td style="padding:5px 0;font-weight:bold;color:#1e293b;">${vorname} ${nachname}</td></tr>
          <tr><td style="${atd}">E-Mail:</td><td style="padding:5px 0;"><a href="mailto:${email}">${email}</a></td></tr>
          ${telefon ? `<tr><td style="${atd}">Telefon:</td><td style="padding:5px 0;">${telefon}</td></tr>` : ''}
          ${verein ? `<tr><td style="${atd}">Verein/Dojo:</td><td style="padding:5px 0;">${verein}</td></tr>` : ''}
          ${aktueller_gurt ? `<tr><td style="${atd}">Aktueller Gurt:</td><td style="padding:5px 0;">${aktueller_gurt}</td></tr>` : ''}
          ${angestrebter_gurt ? `<tr><td style="${atd}">Angestrebter Gurt:</td><td style="padding:5px 0;">${angestrebter_gurt}</td></tr>` : ''}
          ${bemerkungen ? `<tr><td style="${atd}vertical-align:top;">Bemerkungen:</td><td style="padding:5px 0;">${bemerkungen}</td></tr>` : ''}
        </table>
      </div>
      <p style="margin:14px 0 0;">Die Anmeldung ist im Dojo-Admin unter Prüfungen → Termine → Externe Anmeldungen einsehbar.</p>`,
  });

  const text = `
Neue externe Prüfungsanmeldung

Prüfungstermin: ${termin.stil_name} – ${pruefungsdatum}${termin.pruefungsort ? ` | ${termin.pruefungsort}` : ''}

Teilnehmer:
- Name: ${vorname} ${nachname}
- E-Mail: ${email}
${telefon ? `- Telefon: ${telefon}\n` : ''}${verein ? `- Verein: ${verein}\n` : ''}${aktueller_gurt ? `- Aktueller Gurt: ${aktueller_gurt}\n` : ''}${angestrebter_gurt ? `- Angestrebter Gurt: ${angestrebter_gurt}\n` : ''}${bemerkungen ? `- Bemerkungen: ${bemerkungen}\n` : ''}

Die Anmeldung ist im Dojo-Admin einsehbar.
  `;

  return sendEmail({ to: termin.dojo_email, subject, text, html });
};

module.exports = {
  sendEmail,
  sendEmailForDojo,
  sendVertragEmail,
  sendBadgeEmail,
  sendProbetrainingAnfrageEmail,
  sendProbetrainingBestaetigung,
  sendProbetrainingTerminBestaetigung,
  sendPruefungsAnmeldungBestaetigung,
  sendPruefungsAnmeldungAdminNotification,
  createEmailTransporter,
  createEmailTransporterForDojo,
  getEmailSettings,
  getEmailSettingsForDojo,
  getGlobalEmailSettings
};
