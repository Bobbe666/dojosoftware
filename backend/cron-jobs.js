const cron = require('node-cron');
const db = require('./db');
const logger = require('./utils/logger');

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

  logger.info('✅ Cron-Jobs initialisiert', {
    jobs: [
      {
        name: 'Auto-Checkout',
        schedule: '00:00:01 täglich',
        description: 'Checkt Mitglieder vom Vortag automatisch aus'
      }
    ]
  });
}

module.exports = { initCronJobs };
