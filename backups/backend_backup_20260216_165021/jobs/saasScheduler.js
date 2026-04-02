/**
 * SaaS Scheduled Jobs
 * Cron-Jobs für automatische SaaS-Benachrichtigungen und Wartung
 */

const cron = require('node-cron');
const db = require('../db');
const logger = require('../utils/logger');
const { checkAndNotifyExpiringTrials, sendSaasNotification, notifyTDAAdmin } = require('../services/saasNotificationService');

// Job Status Tracking
async function updateJobStatus(jobName, status, error = null) {
  try {
    await db.promise().query(`
      UPDATE saas_cron_jobs
      SET status = ?, last_run = NOW(), last_error = ?, run_count = run_count + 1
      WHERE job_name = ?
    `, [status, error, jobName]);
  } catch (e) {
    logger.error('Fehler beim Job-Status Update:', e.message);
  }
}

/**
 * Job: Trial-Ablauf Erinnerungen prüfen
 * Läuft täglich um 9:00 Uhr
 */
const trialExpiryJob = cron.schedule('0 9 * * *', async () => {
  logger.info('[CRON] Starte Trial-Ablauf Check...');
  await updateJobStatus('check_expiring_trials', 'running');

  try {
    const result = await checkAndNotifyExpiringTrials();

    if (result.success) {
      logger.info(`[CRON] Trial-Check abgeschlossen. ${result.checked} Dojos geprüft.`);
      await updateJobStatus('check_expiring_trials', 'idle');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    logger.error('[CRON] Trial-Check fehlgeschlagen:', error.message);
    await updateJobStatus('check_expiring_trials', 'failed', error.message);
  }
}, {
  scheduled: false, // Wird manuell gestartet
  timezone: 'Europe/Berlin'
});

/**
 * Job: Abgelaufene Trials automatisch auf "expired" setzen
 * Läuft täglich um 00:15 Uhr
 */
const expiredTrialJob = cron.schedule('15 0 * * *', async () => {
  logger.info('[CRON] Prüfe abgelaufene Trials...');
  await updateJobStatus('check_expired_trials', 'running');

  try {
    // Setze abgelaufene Trials auf "expired"
    const [result] = await db.promise().query(`
      UPDATE dojo_subscriptions
      SET status = 'expired'
      WHERE plan_type = 'trial'
        AND trial_ends_at IS NOT NULL
        AND trial_ends_at < NOW()
        AND status = 'active'
    `);

    logger.info(`[CRON] ${result.affectedRows} Trials auf 'expired' gesetzt.`);
    await updateJobStatus('check_expired_trials', 'idle');

  } catch (error) {
    logger.error('[CRON] Expired-Trial Check fehlgeschlagen:', error.message);
    await updateJobStatus('check_expired_trials', 'failed', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Berlin'
});

/**
 * Job: Fehlgeschlagene Zahlungen erneut versuchen zu melden
 * Läuft täglich um 10:00 Uhr
 */
const failedPaymentsJob = cron.schedule('0 10 * * *', async () => {
  logger.info('[CRON] Prüfe fehlgeschlagene Zahlungen...');
  await updateJobStatus('check_failed_payments', 'running');

  try {
    // Finde Dojos mit fehlgeschlagenen Zahlungen in den letzten 3 Tagen
    const [failedPayments] = await db.promise().query(`
      SELECT DISTINCT
        d.id as dojo_id,
        d.dojoname,
        d.email,
        d.inhaber,
        d.subdomain,
        spe.created_at as last_failed_at
      FROM saas_payment_events spe
      JOIN dojo d ON d.id = spe.dojo_id
      WHERE spe.event_type = 'payment_failed'
        AND spe.created_at > DATE_SUB(NOW(), INTERVAL 3 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM saas_notification_log snl
          WHERE snl.dojo_id = spe.dojo_id
            AND snl.notification_type = 'payment_failed'
            AND DATE(snl.sent_at) = DATE(NOW())
        )
    `);

    for (const payment of failedPayments) {
      await sendSaasNotification('paymentFailed', {
        dojo_id: payment.dojo_id,
        dojoname: payment.dojoname,
        email: payment.email,
        inhaber: payment.inhaber,
        subdomain: payment.subdomain
      });

      // Log speichern
      await db.promise().query(`
        INSERT INTO saas_notification_log (dojo_id, notification_type, email_to, sent_at)
        VALUES (?, 'payment_failed', ?, NOW())
      `, [payment.dojo_id, payment.email]);
    }

    logger.info(`[CRON] ${failedPayments.length} Payment-Erinnerungen versendet.`);
    await updateJobStatus('check_failed_payments', 'idle');

  } catch (error) {
    logger.error('[CRON] Failed-Payments Check fehlgeschlagen:', error.message);
    await updateJobStatus('check_failed_payments', 'failed', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Berlin'
});

/**
 * Startet alle Scheduled Jobs
 */
function startAllJobs() {
  logger.info('[CRON] Starte alle SaaS Scheduled Jobs...');

  trialExpiryJob.start();
  expiredTrialJob.start();
  failedPaymentsJob.start();

  logger.info('[CRON] Jobs gestartet:');
  logger.info('  - Trial-Ablauf Check: Täglich 9:00 Uhr');
  logger.info('  - Expired-Trial Update: Täglich 00:15 Uhr');
  logger.info('  - Failed-Payments Check: Täglich 10:00 Uhr');
}

/**
 * Stoppt alle Scheduled Jobs
 */
function stopAllJobs() {
  logger.info('[CRON] Stoppe alle SaaS Scheduled Jobs...');

  trialExpiryJob.stop();
  expiredTrialJob.stop();
  failedPaymentsJob.stop();
}

/**
 * Führt einen Job manuell aus (für Testing/Admin)
 */
async function runJobManually(jobName) {
  logger.info(`[CRON] Manueller Start von Job: ${jobName}`);

  switch (jobName) {
    case 'check_expiring_trials':
      return await checkAndNotifyExpiringTrials();
    case 'check_expired_trials':
      // Inline ausführen
      const [result] = await db.promise().query(`
        UPDATE dojo_subscriptions
        SET status = 'expired'
        WHERE plan_type = 'trial'
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at < NOW()
          AND status = 'active'
      `);
      return { success: true, affected: result.affectedRows };
    default:
      return { success: false, error: 'Unbekannter Job' };
  }
}

/**
 * Gibt den Status aller Jobs zurück
 */
async function getJobsStatus() {
  try {
    const [jobs] = await db.promise().query(`
      SELECT job_name, last_run, next_run, status, last_error, run_count
      FROM saas_cron_jobs
      ORDER BY job_name
    `);
    return jobs;
  } catch (error) {
    return [];
  }
}

module.exports = {
  startAllJobs,
  stopAllJobs,
  runJobManually,
  getJobsStatus,
  // Einzelne Jobs für manuelles Triggern
  trialExpiryJob,
  expiredTrialJob,
  failedPaymentsJob
};
