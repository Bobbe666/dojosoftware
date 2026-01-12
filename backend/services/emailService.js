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

module.exports = {
  sendEmail,
  sendVertragEmail,
  createEmailTransporter,
  getEmailSettings
};
