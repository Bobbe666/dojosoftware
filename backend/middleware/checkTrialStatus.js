// =============================================
// TRIAL STATUS MIDDLEWARE
// =============================================
// Prüft ob das Dojo noch im Trial ist oder ein aktives Abo hat

const db = require('../db');
const logger = require('../utils/logger');

/**
 * Middleware: Prüft Trial/Subscription Status
 * Blockiert Zugriff wenn Trial abgelaufen und kein aktives Abo
 */
const checkTrialStatus = async (req, res, next) => {
  try {
    const { user } = req;

    // Kein User = nicht authentifiziert (wird von authenticateToken gehandhabt)
    if (!user) {
      return next();
    }

    // Super-Admin (dojo_id = null) hat immer Zugriff
    if (user.dojo_id === null) {
      return next();
    }

    // Hole Dojo-Informationen
    const [dojos] = await db.promise().query(
      `SELECT
        id,
        dojoname,
        subscription_status,
        trial_ends_at,
        subscription_ends_at
      FROM dojo
      WHERE id = ?`,
      [user.dojo_id]
    );

    // Dojo nicht gefunden
    if (dojos.length === 0) {
      return res.status(404).json({
        error: 'Dojo nicht gefunden',
        code: 'DOJO_NOT_FOUND'
      });
    }

    const dojo = dojos[0];

    // Prüfe Status
    switch (dojo.subscription_status) {
      case 'active':
        // Aktives Abo - prüfe Ablaufdatum
        if (dojo.subscription_ends_at && new Date(dojo.subscription_ends_at) < new Date()) {
          // Abo abgelaufen, setze Status
          await db.promise().query(
            'UPDATE dojo SET subscription_status = ? WHERE id = ?',
            ['expired', dojo.id]
          );

          return res.status(403).json({
            error: 'Abonnement abgelaufen',
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Ihr Abonnement ist abgelaufen. Bitte erneuern Sie Ihr Abonnement.',
            dojo_id: dojo.id,
            dojoname: dojo.dojoname
          });
        }
        // Abo aktiv und gültig
        return next();

      case 'trial':
        // Trial - prüfe Ablaufdatum
        if (new Date(dojo.trial_ends_at) < new Date()) {
          // Trial abgelaufen, setze Status
          await db.promise().query(
            'UPDATE dojo SET subscription_status = ? WHERE id = ?',
            ['expired', dojo.id]
          );

          return res.status(403).json({
            error: 'Testphase abgelaufen',
            code: 'TRIAL_EXPIRED',
            message: 'Ihre 14-tägige Testphase ist abgelaufen. Bitte schließen Sie ein Abonnement ab.',
            trial_ends_at: dojo.trial_ends_at,
            dojo_id: dojo.id,
            dojoname: dojo.dojoname
          });
        }
        // Trial noch gültig
        return next();

      case 'expired':
        // Bereits als abgelaufen markiert
        return res.status(403).json({
          error: 'Zugriff gesperrt',
          code: 'ACCESS_EXPIRED',
          message: 'Ihr Zugang ist abgelaufen. Bitte schließen Sie ein Abonnement ab.',
          dojo_id: dojo.id,
          dojoname: dojo.dojoname
        });

      case 'cancelled':
      case 'suspended':
        // Gekündigt oder suspendiert
        return res.status(403).json({
          error: 'Zugriff gesperrt',
          code: 'ACCESS_DENIED',
          message: `Ihr Zugang wurde ${dojo.subscription_status === 'cancelled' ? 'gekündigt' : 'gesperrt'}. Bitte kontaktieren Sie den Support.`,
          dojo_id: dojo.id,
          dojoname: dojo.dojoname
        });

      default:
        // Unbekannter Status
        logger.error('⚠️ Unbekannter subscription_status:', { error: dojo.subscription_status });
        return next();
    }

  } catch (error) {
    logger.error('Fehler beim Trial-Status Check:', error);
    // Bei Fehler durchlassen (fail open), aber loggen
    return next();
  }
};

module.exports = checkTrialStatus;
