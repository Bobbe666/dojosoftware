/**
 * Email Templates für DojoSoftware
 * Zentrale Sammlung aller Email-Vorlagen
 */

const { sendEmail, sendEmailForDojo } = require('./emailService');
const logger = require('../utils/logger');

/**
 * Verification Email für neue Benutzer
 */
async function sendVerificationEmail(email, { name, verificationToken, verificationUrl }) {
  const url = verificationUrl || `https://dojo.tda-intl.org/verify?token=${verificationToken}`;

  return sendEmail({
    to: email,
    subject: 'Bitte bestätige deine E-Mail-Adresse',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">E-Mail bestätigen</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px; color: #333;">Hallo ${name || 'Nutzer'},</p>
          <p style="color: #555; line-height: 1.6;">
            Bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Button klickst:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
              E-Mail bestätigen
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Oder kopiere diesen Link in deinen Browser:<br>
            <a href="${url}" style="color: #3b82f6; word-break: break-all;">${url}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Falls du diese Registrierung nicht angefordert hast, kannst du diese E-Mail ignorieren.
          </p>
        </div>
      </div>
    `,
    text: `Hallo ${name || 'Nutzer'},\n\nBitte bestätige deine E-Mail-Adresse:\n${url}\n\nFalls du diese Registrierung nicht angefordert hast, ignoriere diese E-Mail.`
  });
}

/**
 * Passwort-Reset Email
 */
async function sendPasswordResetEmail(email, { name, resetToken, resetUrl }) {
  const url = resetUrl || `https://dojo.tda-intl.org/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: 'Passwort zurücksetzen',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">Passwort zurücksetzen</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px; color: #333;">Hallo ${name || 'Nutzer'},</p>
          <p style="color: #555; line-height: 1.6;">
            Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.
            Klicke auf den Button unten, um ein neues Passwort zu erstellen:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="display: inline-block; background: #f59e0b; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
              Neues Passwort erstellen
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Dieser Link ist 24 Stunden gültig.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren.
          </p>
        </div>
      </div>
    `,
    text: `Hallo ${name || 'Nutzer'},\n\nDu hast eine Passwort-Zurücksetzung angefordert.\n\nKlicke hier: ${url}\n\nDer Link ist 24 Stunden gültig.\n\nFalls du dies nicht angefordert hast, ignoriere diese E-Mail.`
  });
}

/**
 * Willkommens-Email für neue Dojos
 */
async function sendWelcomeEmail(email, { dojoName, adminName, loginUrl, subdomain }) {
  const url = loginUrl || `https://${subdomain || 'app'}.dojo.tda-intl.org/login`;

  return sendEmail({
    to: email,
    subject: `Willkommen bei DojoSoftware - ${dojoName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">Willkommen!</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">${dojoName}</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px; color: #333;">Hallo ${adminName || 'Dojo-Admin'},</p>
          <p style="color: #555; line-height: 1.6;">
            Dein Dojo <strong>${dojoName}</strong> wurde erfolgreich eingerichtet!
          </p>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>Deine Trial-Phase:</strong></p>
            <ul style="color: #166534; margin: 10px 0;">
              <li>14 Tage kostenlos testen</li>
              <li>Alle Features freigeschaltet</li>
              <li>Keine Kreditkarte erforderlich</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
              Jetzt loslegen
            </a>
          </div>
          <p style="color: #555; line-height: 1.6;">
            Bei Fragen erreichst du uns unter <a href="mailto:support@tda-intl.org">support@tda-intl.org</a>.
          </p>
          <p style="color: #555;">
            Viel Erfolg!<br>
            <strong>Dein TDA International Team</strong>
          </p>
        </div>
      </div>
    `,
    text: `Willkommen bei DojoSoftware!\n\nHallo ${adminName || 'Dojo-Admin'},\n\nDein Dojo "${dojoName}" wurde erfolgreich eingerichtet!\n\nDeine Trial-Phase:\n- 14 Tage kostenlos testen\n- Alle Features freigeschaltet\n- Keine Kreditkarte erforderlich\n\nJetzt loslegen: ${url}\n\nBei Fragen: support@tda-intl.org\n\nViel Erfolg!\nDein TDA International Team`
  });
}

/**
 * Zahlungserinnerung / Mahnung
 */
async function sendPaymentReminderEmail(dojoId, email, { memberName, amount, dueDate, invoiceNumber, reminderLevel }) {
  const levelTexts = {
    1: 'Freundliche Erinnerung',
    2: 'Zweite Mahnung',
    3: 'Letzte Mahnung'
  };

  const levelColors = {
    1: '#3b82f6',
    2: '#f59e0b',
    3: '#ef4444'
  };

  return sendEmailForDojo(dojoId, {
    to: email,
    subject: `${levelTexts[reminderLevel] || 'Zahlungserinnerung'} - Rechnung ${invoiceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${levelColors[reminderLevel] || '#3b82f6'}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">${levelTexts[reminderLevel] || 'Zahlungserinnerung'}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px; color: #333;">Hallo ${memberName},</p>
          <p style="color: #555; line-height: 1.6;">
            wir möchten Sie freundlich an die ausstehende Zahlung erinnern:
          </p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="color: #666; padding: 5px 0;">Rechnungsnummer:</td>
                <td style="text-align: right; font-weight: bold;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0;">Betrag:</td>
                <td style="text-align: right; font-weight: bold;">€${amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color: #666; padding: 5px 0;">Fällig seit:</td>
                <td style="text-align: right;">${new Date(dueDate).toLocaleDateString('de-DE')}</td>
              </tr>
            </table>
          </div>
          <p style="color: #555; line-height: 1.6;">
            Bitte überweisen Sie den Betrag zeitnah. Falls Sie bereits gezahlt haben, betrachten Sie diese Nachricht als gegenstandslos.
          </p>
        </div>
      </div>
    `,
    text: `${levelTexts[reminderLevel] || 'Zahlungserinnerung'}\n\nHallo ${memberName},\n\nwir möchten Sie an die ausstehende Zahlung erinnern:\n\nRechnungsnummer: ${invoiceNumber}\nBetrag: €${amount.toFixed(2)}\nFällig seit: ${new Date(dueDate).toLocaleDateString('de-DE')}\n\nBitte überweisen Sie den Betrag zeitnah.`
  });
}

/**
 * Event-Anmeldung Bestätigung
 */
async function sendEventRegistrationEmail(dojoId, email, { memberName, eventName, eventDate, eventLocation }) {
  return sendEmailForDojo(dojoId, {
    to: email,
    subject: `Anmeldebestätigung: ${eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">Anmeldung bestätigt!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <p style="font-size: 16px; color: #333;">Hallo ${memberName},</p>
          <p style="color: #555; line-height: 1.6;">
            Deine Anmeldung wurde erfolgreich registriert:
          </p>
          <div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #6d28d9;">${eventName}</p>
            <p style="margin: 0; color: #555;">
              <strong>Datum:</strong> ${new Date(eventDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br>
              ${eventLocation ? `<strong>Ort:</strong> ${eventLocation}` : ''}
            </p>
          </div>
          <p style="color: #555;">
            Wir freuen uns auf deine Teilnahme!
          </p>
        </div>
      </div>
    `,
    text: `Anmeldung bestätigt!\n\nHallo ${memberName},\n\nDeine Anmeldung wurde registriert:\n\n${eventName}\nDatum: ${new Date(eventDate).toLocaleDateString('de-DE')}\n${eventLocation ? `Ort: ${eventLocation}` : ''}\n\nWir freuen uns auf deine Teilnahme!`
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPaymentReminderEmail,
  sendEventRegistrationEmail
};
