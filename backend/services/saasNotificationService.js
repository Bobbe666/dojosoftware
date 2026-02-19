/**
 * SaaS Notification Service
 * Benachrichtigungen für Subscription-Events (Trial, Payments, etc.)
 */

const db = require('../db');
const logger = require('../utils/logger');
const { sendEmail, getGlobalEmailSettings } = require('./emailService');
const saasSettings = require('./saasSettingsService');

/**
 * Email-Templates für verschiedene SaaS-Events
 */
const TEMPLATES = {
  // Trial läuft in X Tagen ab
  trialExpiringSoon: (data) => ({
    subject: `⏰ Ihr Trial bei DojoSoftware läuft in ${data.daysLeft} Tagen ab`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">⏰ Trial endet bald!</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Noch ${data.daysLeft} Tage verbleibend</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Hallo ${data.inhaber || 'Dojo-Admin'},</p>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Ihr kostenloser Trial für <strong>${data.dojoname}</strong> endet am
            <strong>${new Date(data.trialEndsAt).toLocaleDateString('de-DE')}</strong>.
          </p>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>Nach Ablauf des Trials:</strong><br>
              • Der Zugang zu Ihrer DojoSoftware bleibt erhalten<br>
              • Einige Premium-Features werden deaktiviert<br>
              • Ihre Daten bleiben vollständig gespeichert
            </p>
          </div>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Upgraden Sie jetzt auf einen bezahlten Plan, um weiterhin alle Features nutzen zu können:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://${data.subdomain || 'app'}.dojo.tda-intl.org/einstellungen?tab=subscription"
               style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Jetzt upgraden →
            </a>
          </div>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Bei Fragen stehen wir Ihnen gerne zur Verfügung.<br><br>
            Mit freundlichen Grüßen<br>
            <strong>Ihr TDA International Team</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="font-size: 12px; color: #999; text-align: center;">
            Diese E-Mail wurde automatisch versendet.<br>
            <a href="mailto:support@tda-intl.org">support@tda-intl.org</a>
          </p>
        </div>
      </div>
    `,
    text: `
Hallo ${data.inhaber || 'Dojo-Admin'},

Ihr kostenloser Trial für ${data.dojoname} endet am ${new Date(data.trialEndsAt).toLocaleDateString('de-DE')}.

Nach Ablauf des Trials:
- Der Zugang zu Ihrer DojoSoftware bleibt erhalten
- Einige Premium-Features werden deaktiviert
- Ihre Daten bleiben vollständig gespeichert

Upgraden Sie jetzt auf einen bezahlten Plan:
https://${data.subdomain || 'app'}.dojo.tda-intl.org/einstellungen?tab=subscription

Bei Fragen: support@tda-intl.org

Mit freundlichen Grüßen
Ihr TDA International Team
    `.trim()
  }),

  // Trial abgelaufen
  trialExpired: (data) => ({
    subject: `❌ Ihr Trial bei DojoSoftware ist abgelaufen`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">Trial abgelaufen</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">${data.dojoname}</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Hallo ${data.inhaber || 'Dojo-Admin'},</p>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Der kostenlose Trial für <strong>${data.dojoname}</strong> ist am
            <strong>${new Date(data.trialEndsAt).toLocaleDateString('de-DE')}</strong> abgelaufen.
          </p>

          <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #991b1b;">
              <strong>Was bedeutet das?</strong><br>
              • Premium-Features sind nun eingeschränkt<br>
              • Ihre Daten sind weiterhin sicher gespeichert<br>
              • Sie können jederzeit upgraden, um alle Features wieder zu nutzen
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://${data.subdomain || 'app'}.dojo.tda-intl.org/einstellungen?tab=subscription"
               style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Jetzt Plan wählen →
            </a>
          </div>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Mit freundlichen Grüßen<br>
            <strong>Ihr TDA International Team</strong>
          </p>
        </div>
      </div>
    `,
    text: `
Hallo ${data.inhaber || 'Dojo-Admin'},

Der kostenlose Trial für ${data.dojoname} ist am ${new Date(data.trialEndsAt).toLocaleDateString('de-DE')} abgelaufen.

Was bedeutet das?
- Premium-Features sind nun eingeschränkt
- Ihre Daten sind weiterhin sicher gespeichert
- Sie können jederzeit upgraden

Jetzt Plan wählen:
https://${data.subdomain || 'app'}.dojo.tda-intl.org/einstellungen?tab=subscription

Mit freundlichen Grüßen
Ihr TDA International Team
    `.trim()
  }),

  // Zahlung erfolgreich / Plan-Upgrade
  paymentSuccess: (data) => ({
    subject: `✅ Willkommen beim ${data.planName} Plan!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">🎉 Upgrade erfolgreich!</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">${data.dojoname} - ${data.planName}</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Hallo ${data.inhaber || 'Dojo-Admin'},</p>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Vielen Dank für Ihr Upgrade auf den <strong>${data.planName}</strong> Plan!
            Ihre Zahlung wurde erfolgreich verarbeitet.
          </p>

          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="color: #166534; padding: 5px 0;">Plan:</td>
                <td style="text-align: right; font-weight: bold;">${data.planName}</td>
              </tr>
              <tr>
                <td style="color: #166534; padding: 5px 0;">Preis:</td>
                <td style="text-align: right; font-weight: bold;">€${data.price}/${data.interval === 'yearly' ? 'Jahr' : 'Monat'}</td>
              </tr>
              <tr>
                <td style="color: #166534; padding: 5px 0;">Nächste Zahlung:</td>
                <td style="text-align: right;">${data.nextPaymentDate || '-'}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Alle Features Ihres neuen Plans sind ab sofort freigeschaltet.
            Wir wünschen Ihnen viel Erfolg mit DojoSoftware!
          </p>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Mit freundlichen Grüßen<br>
            <strong>Ihr TDA International Team</strong>
          </p>
        </div>
      </div>
    `,
    text: `
Hallo ${data.inhaber || 'Dojo-Admin'},

Vielen Dank für Ihr Upgrade auf den ${data.planName} Plan!
Ihre Zahlung wurde erfolgreich verarbeitet.

Plan: ${data.planName}
Preis: €${data.price}/${data.interval === 'yearly' ? 'Jahr' : 'Monat'}

Alle Features sind ab sofort freigeschaltet.

Mit freundlichen Grüßen
Ihr TDA International Team
    `.trim()
  }),

  // Zahlung fehlgeschlagen
  paymentFailed: (data) => ({
    subject: `⚠️ Zahlung fehlgeschlagen - Aktion erforderlich`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">⚠️ Zahlung fehlgeschlagen</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">${data.dojoname}</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Hallo ${data.inhaber || 'Dojo-Admin'},</p>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Leider konnte Ihre letzte Zahlung für <strong>${data.dojoname}</strong> nicht verarbeitet werden.
          </p>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>Bitte aktualisieren Sie Ihre Zahlungsmethode</strong>, um eine Unterbrechung
              Ihres Service zu vermeiden.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://${data.subdomain || 'app'}.dojo.tda-intl.org/einstellungen?tab=subscription"
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Zahlungsmethode aktualisieren →
            </a>
          </div>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Bei Fragen kontaktieren Sie uns gerne unter
            <a href="mailto:support@tda-intl.org">support@tda-intl.org</a>.
          </p>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Mit freundlichen Grüßen<br>
            <strong>Ihr TDA International Team</strong>
          </p>
        </div>
      </div>
    `,
    text: `
Hallo ${data.inhaber || 'Dojo-Admin'},

Leider konnte Ihre letzte Zahlung für ${data.dojoname} nicht verarbeitet werden.

Bitte aktualisieren Sie Ihre Zahlungsmethode:
https://${data.subdomain || 'app'}.dojo.tda-intl.org/einstellungen?tab=subscription

Bei Fragen: support@tda-intl.org

Mit freundlichen Grüßen
Ihr TDA International Team
    `.trim()
  }),

  // Admin-Benachrichtigung bei Upgrade
  adminUpgradeNotification: (data) => ({
    subject: `🎉 Neues Upgrade: ${data.dojoname} → ${data.planName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🎉 Neues Plan-Upgrade!</h1>
        </div>

        <div style="background: #ffffff; padding: 20px; border-radius: 0 0 10px 10px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Dojo:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${data.dojoname}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Inhaber:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.inhaber || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Von Plan:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.oldPlan || 'Trial'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Zu Plan:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong style="color: #22c55e;">${data.planName}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">MRR:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>+€${data.price}/${data.interval === 'yearly' ? 'Jahr' : 'Monat'}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #666;">Zeitpunkt:</td>
              <td style="padding: 8px;">${new Date().toLocaleString('de-DE')}</td>
            </tr>
          </table>
        </div>
      </div>
    `,
    text: `
Neues Plan-Upgrade!

Dojo: ${data.dojoname}
Inhaber: ${data.inhaber || '-'}
Von: ${data.oldPlan || 'Trial'} → ${data.planName}
MRR: +€${data.price}/${data.interval === 'yearly' ? 'Jahr' : 'Monat'}
Zeit: ${new Date().toLocaleString('de-DE')}
    `.trim()
  })
};

/**
 * Sendet SaaS-Benachrichtigung
 */
async function sendSaasNotification(type, data) {
  try {
    const template = TEMPLATES[type];
    if (!template) {
      throw new Error(`Unbekannter Template-Typ: ${type}`);
    }

    const email = template(data);

    const result = await sendEmail({
      to: data.email,
      subject: email.subject,
      text: email.text,
      html: email.html
    });

    if (result.success) {
      logger.info(`SaaS-Benachrichtigung gesendet: ${type}`, { dojo_id: data.dojo_id, email: data.email });
    }

    return result;
  } catch (error) {
    logger.error(`SaaS-Benachrichtigung fehlgeschlagen: ${type}`, { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sendet Benachrichtigung an TDA-Admin
 */
async function notifyTDAAdmin(type, data) {
  try {
    const template = TEMPLATES[type];
    if (!template) return;

    const email = template(data);
    const adminEmail = await saasSettings.getAdminEmail();

    await sendEmail({
      to: adminEmail,
      subject: email.subject,
      text: email.text,
      html: email.html
    });

    logger.info('TDA-Admin benachrichtigt:', { type, dojo: data.dojoname, to: adminEmail });
  } catch (error) {
    logger.error('TDA-Admin Benachrichtigung fehlgeschlagen:', { error: error.message });
  }
}

/**
 * Prüft und sendet Trial-Ablauf Benachrichtigungen
 * Wird täglich per Cron ausgeführt
 */
async function checkAndNotifyExpiringTrials() {
  try {
    logger.info('Prüfe ablaufende Trials...');

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Finde Dojos mit ablaufenden Trials
    const [dojos] = await db.promise().query(`
      SELECT
        d.id as dojo_id,
        d.dojoname,
        d.email,
        d.inhaber,
        d.subdomain,
        ds.trial_ends_at,
        ds.plan_type,
        DATEDIFF(ds.trial_ends_at, NOW()) as days_left
      FROM dojo d
      JOIN dojo_subscriptions ds ON d.id = ds.dojo_id
      WHERE ds.plan_type = 'trial'
        AND ds.trial_ends_at IS NOT NULL
        AND ds.trial_ends_at > NOW()
        AND (
          DATE(ds.trial_ends_at) = DATE(?) OR
          DATE(ds.trial_ends_at) = DATE(?) OR
          DATE(ds.trial_ends_at) = DATE(?)
        )
    `, [in7Days, in3Days, in1Day]);

    logger.info(`${dojos.length} Dojos mit ablaufenden Trials gefunden`);

    for (const dojo of dojos) {
      // Prüfe ob bereits benachrichtigt
      const [existing] = await db.promise().query(`
        SELECT 1 FROM saas_notification_log
        WHERE dojo_id = ? AND notification_type = 'trial_expiring_soon'
          AND DATE(sent_at) = DATE(NOW())
        LIMIT 1
      `, [dojo.dojo_id]);

      if (existing.length > 0) {
        logger.debug(`Dojo ${dojo.dojo_id} bereits heute benachrichtigt`);
        continue;
      }

      // Benachrichtigung senden
      const result = await sendSaasNotification('trialExpiringSoon', {
        ...dojo,
        daysLeft: dojo.days_left,
        trialEndsAt: dojo.trial_ends_at
      });

      // Log speichern
      if (result.success) {
        await db.promise().query(`
          INSERT INTO saas_notification_log (dojo_id, notification_type, email_to, sent_at)
          VALUES (?, 'trial_expiring_soon', ?, NOW())
        `, [dojo.dojo_id, dojo.email]);
      }
    }

    // Prüfe abgelaufene Trials (für "Trial abgelaufen" Email)
    const [expiredDojos] = await db.promise().query(`
      SELECT
        d.id as dojo_id,
        d.dojoname,
        d.email,
        d.inhaber,
        d.subdomain,
        ds.trial_ends_at
      FROM dojo d
      JOIN dojo_subscriptions ds ON d.id = ds.dojo_id
      WHERE ds.plan_type = 'trial'
        AND ds.trial_ends_at IS NOT NULL
        AND DATE(ds.trial_ends_at) = DATE(DATE_SUB(NOW(), INTERVAL 1 DAY))
    `);

    for (const dojo of expiredDojos) {
      const [existing] = await db.promise().query(`
        SELECT 1 FROM saas_notification_log
        WHERE dojo_id = ? AND notification_type = 'trial_expired'
        LIMIT 1
      `, [dojo.dojo_id]);

      if (existing.length > 0) continue;

      const result = await sendSaasNotification('trialExpired', {
        ...dojo,
        trialEndsAt: dojo.trial_ends_at
      });

      if (result.success) {
        await db.promise().query(`
          INSERT INTO saas_notification_log (dojo_id, notification_type, email_to, sent_at)
          VALUES (?, 'trial_expired', ?, NOW())
        `, [dojo.dojo_id, dojo.email]);
      }
    }

    logger.info('Trial-Benachrichtigungen abgeschlossen');
    return { success: true, checked: dojos.length + expiredDojos.length };

  } catch (error) {
    logger.error('Fehler bei Trial-Benachrichtigungen:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendSaasNotification,
  notifyTDAAdmin,
  checkAndNotifyExpiringTrials,
  TEMPLATES
};
