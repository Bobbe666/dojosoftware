/**
 * Email Templates für DojoSoftware
 * Zentrale Sammlung aller Email-Vorlagen
 */

const { sendEmail, sendEmailForDojo } = require('./emailService');
const { renderEmail, getDojoMailTheme } = require('./emailLayout');
const logger = require('../utils/logger');

/**
 * Verification Email für neue Benutzer
 */
async function sendVerificationEmail(email, { name, verificationToken, verificationUrl }) {
  const url = verificationUrl || `https://dojo.tda-intl.org/verify?token=${verificationToken}`;

  return sendEmail({
    to: email,
    subject: 'Bitte bestätige deine E-Mail-Adresse',
    html: renderEmail({
      anlass: 'begruessung', titel: 'DojoSoftware', subtitel: 'E-Mail bestätigen',
      bodyHtml: `
        <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${name || 'Nutzer'},</p>
        <p style="margin:0 0 8px;">bitte bestätige deine E-Mail-Adresse über den Button.</p>
        <p style="margin:0;color:#64748b;font-size:13px;">Oder kopiere diesen Link in deinen Browser:<br><a href="${url}" style="word-break:break-all;">${url}</a></p>`,
      cta: { url, label: 'E-Mail bestätigen' },
      footerNote: 'Falls du diese Registrierung nicht angefordert hast, ignoriere diese E-Mail.',
    }),
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
    html: renderEmail({
      anlass: 'allgemein', titel: 'DojoSoftware', subtitel: 'Passwort zurücksetzen',
      bodyHtml: `
        <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${name || 'Nutzer'},</p>
        <p style="margin:0;">du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button, um ein neues Passwort zu erstellen.</p>
        <p style="margin:14px 0 0;color:#64748b;font-size:13px;">Dieser Link ist 24 Stunden gültig.</p>`,
      cta: { url, label: 'Neues Passwort erstellen' },
      footerNote: 'Falls du kein neues Passwort angefordert hast, ignoriere diese E-Mail.',
    }),
    text: `Hallo ${name || 'Nutzer'},\n\nDu hast eine Passwort-Zurücksetzung angefordert.\n\nKlicke hier: ${url}\n\nDer Link ist 24 Stunden gültig.\n\nFalls du dies nicht angefordert hast, ignoriere diese E-Mail.`
  });
}

/**
 * Willkommens-Email für neue Dojos
 */
async function sendWelcomeEmail(email, { dojoName, adminName, loginUrl, subdomain }) {
  const url = loginUrl || `https://${subdomain || 'app'}.dojo.tda-intl.org/login`;
  const theme = await getDojoMailTheme({ dojoname: dojoName });

  return sendEmail({
    to: email,
    subject: `Willkommen bei DojoSoftware - ${dojoName}`,
    html: renderEmail({
      theme, anlass: 'begruessung', titel: dojoName || 'DojoSoftware', subtitel: 'Willkommen bei DojoSoftware!',
      bodyHtml: `
        <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${adminName || 'Dojo-Admin'},</p>
        <p style="margin:0 0 4px;">dein Dojo <strong>${dojoName}</strong> wurde erfolgreich eingerichtet!</p>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:16px 0;">
          <p style="margin:0 0 8px;color:#166534;"><strong>Deine Trial-Phase:</strong></p>
          <ul style="color:#166534;margin:0;padding-left:20px;line-height:1.8;">
            <li>14 Tage kostenlos testen</li><li>Alle Features freigeschaltet</li><li>Keine Kreditkarte erforderlich</li>
          </ul>
        </div>
        <p style="margin:14px 0 0;">Bei Fragen erreichst du uns unter <a href="mailto:support@tda-intl.org">support@tda-intl.org</a>.</p>
        <p style="margin:14px 0 0;">Viel Erfolg!<br><strong>Dein TDA International Team</strong></p>`,
      cta: { url, label: 'Jetzt loslegen' },
    }),
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

  const theme = await getDojoMailTheme({ dojoId });
  const levelColor = levelColors[reminderLevel] || '#3b82f6';
  const titel = levelTexts[reminderLevel] || 'Zahlungserinnerung';

  return sendEmailForDojo(dojoId, {
    to: email,
    subject: `${titel} - Rechnung ${invoiceNumber}`,
    html: renderEmail({
      theme, anlass: 'rechnung', titel: theme.dojoName || 'Dojo', subtitel: titel,
      bodyHtml: `
        <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${memberName},</p>
        <p style="margin:0 0 4px;">wir möchten dich freundlich an die ausstehende Zahlung erinnern:</p>
        <div style="background:#f9fafb;border-left:4px solid ${levelColor};border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;">
          <table role="presentation" width="100%" style="font-size:14px;">
            <tr><td style="color:#64748b;padding:5px 0;">Rechnungsnummer:</td><td style="text-align:right;font-weight:bold;color:#1e293b;">${invoiceNumber}</td></tr>
            <tr><td style="color:#64748b;padding:5px 0;">Betrag:</td><td style="text-align:right;font-weight:bold;color:#1e293b;">€${amount.toFixed(2)}</td></tr>
            <tr><td style="color:#64748b;padding:5px 0;">Fällig seit:</td><td style="text-align:right;color:#1e293b;">${new Date(dueDate).toLocaleDateString('de-DE')}</td></tr>
          </table>
        </div>
        <p style="margin:0;">Bitte überweise den Betrag zeitnah. Falls du bereits gezahlt hast, betrachte diese Nachricht als gegenstandslos.</p>`,
    }),
    text: `${titel}\n\nHallo ${memberName},\n\nwir möchten dich an die ausstehende Zahlung erinnern:\n\nRechnungsnummer: ${invoiceNumber}\nBetrag: €${amount.toFixed(2)}\nFällig seit: ${new Date(dueDate).toLocaleDateString('de-DE')}\n\nBitte überweise den Betrag zeitnah.`
  });
}

/**
 * Event-Anmeldung Bestätigung
 */
async function sendEventRegistrationEmail(dojoId, email, { memberName, eventName, eventDate, eventLocation }) {
  const theme = await getDojoMailTheme({ dojoId });
  return sendEmailForDojo(dojoId, {
    to: email,
    subject: `Anmeldebestätigung: ${eventName}`,
    html: renderEmail({
      theme, anlass: 'begruessung', titel: theme.dojoName || 'Dojo', subtitel: 'Anmeldung bestätigt!',
      bodyHtml: `
        <p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo ${memberName},</p>
        <p style="margin:0 0 4px;">deine Anmeldung wurde erfolgreich registriert:</p>
        <div style="background:#f8fafc;border-left:4px solid ${theme.accent};border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;">
          <p style="margin:0 0 8px;font-weight:bold;color:#1e293b;font-size:16px;">${eventName}</p>
          <p style="margin:0;color:#475569;"><strong>Datum:</strong> ${new Date(eventDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${eventLocation ? `<br><strong>Ort:</strong> ${eventLocation}` : ''}</p>
        </div>
        <p style="margin:0;">Wir freuen uns auf deine Teilnahme!</p>`,
    }),
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
