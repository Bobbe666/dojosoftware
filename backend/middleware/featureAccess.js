const db = require('../db');

/**
 * Feature-Toggle Middleware
 * Pr\u00fcft ob ein Dojo Zugriff auf bestimmte Features hat basierend auf Subscription-Plan
 */

/**
 * Middleware: Erfordert bestimmtes Feature
 * @param {string} featureName - 'verkauf', 'buchfuehrung', 'events', 'multidojo', 'api'
 */
function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      // Super-Admin (id=1 oder username='admin') darf alles
      const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
      const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

      // Debug logging
      console.log('🔍 Feature Check Debug:', {
        feature: featureName,
        userId,
        username: req.user?.username,
        isSuperAdmin,
        userObject: req.user
      });

      if (isSuperAdmin) {
        console.log('✅ Super-Admin Bypass für Feature:', featureName);
        return next();
      }

      // Hole dojo_id aus User-Session/JWT
      const dojoId = req.user?.dojo_id || req.body?.dojo_id || req.query?.dojo_id;

      if (!dojoId) {
        return res.status(401).json({
          error: 'Nicht autorisiert - Dojo-ID fehlt',
          feature_required: featureName
        });
      }

      // Lade Subscription
      const [subscription] = await db.promise().query(
        `SELECT s.plan_type, s.status,
                s.feature_verkauf, s.feature_buchfuehrung,
                s.feature_events, s.feature_multidojo, s.feature_api,
                s.trial_ends_at, s.subscription_ends_at,
                d.dojoname as dojo_name, d.subdomain
         FROM dojo_subscriptions s
         JOIN dojo d ON s.dojo_id = d.id
         WHERE s.dojo_id = ?`,
        [dojoId]
      );

      if (subscription.length === 0) {
        return res.status(403).json({
          error: 'Keine aktive Subscription gefunden',
          feature_required: featureName,
          upgrade_url: '/upgrade'
        });
      }

      const sub = subscription[0];

      // Pr\u00fcfe Subscription-Status
      if (sub.status === 'suspended' || sub.status === 'cancelled' || sub.status === 'expired') {
        return res.status(403).json({
          error: `Subscription ist ${sub.status}. Bitte reaktivieren Sie Ihr Abonnement.`,
          feature_required: featureName,
          subscription_status: sub.status,
          upgrade_url: '/upgrade'
        });
      }

      // Pr\u00fcfe ob Trial abgelaufen
      if (sub.status === 'trial' && sub.trial_ends_at) {
        const trialEnd = new Date(sub.trial_ends_at);
        const now = new Date();

        if (now > trialEnd) {
          return res.status(403).json({
            error: 'Trial-Phase ist abgelaufen. Bitte w\u00e4hlen Sie einen bezahlten Plan.',
            feature_required: featureName,
            subscription_status: 'trial_expired',
            trial_ended_at: sub.trial_ends_at,
            upgrade_url: '/upgrade'
          });
        }
      }

      // Feature-Check
      const featureColumnMap = {
        verkauf: 'feature_verkauf',
        buchfuehrung: 'feature_buchfuehrung',
        events: 'feature_events',
        multidojo: 'feature_multidojo',
        api: 'feature_api'
      };

      const featureColumn = featureColumnMap[featureName];

      if (!featureColumn) {
        return res.status(500).json({
          error: `Unbekanntes Feature: ${featureName}`
        });
      }

      const hasFeature = sub[featureColumn] === 1 || sub[featureColumn] === true;

      if (!hasFeature) {
        return res.status(403).json({
          error: `Feature "${featureName}" ist in Ihrem Plan "${sub.plan_type}" nicht enthalten`,
          feature_required: featureName,
          current_plan: sub.plan_type,
          upgrade_url: '/upgrade',
          message: `Upgraden Sie auf einen h\u00f6heren Plan um "${featureName}" zu nutzen.`
        });
      }

      // Feature verf\u00fcgbar - speichere Subscription-Info in Request
      req.subscription = sub;
      next();

    } catch (error) {
      console.error('Fehler bei Feature-Check:', error);
      res.status(500).json({
        error: 'Serverfehler bei Feature-Pr\u00fcfung'
      });
    }
  };
}

/**
 * Middleware: Pr\u00fcft ob Mitgliederlimit erreicht ist
 */
async function checkMemberLimit(req, res, next) {
  try {
    const dojoId = req.user?.dojo_id || req.body?.dojo_id;

    if (!dojoId) {
      return res.status(401).json({ error: 'Dojo-ID fehlt' });
    }

    // Lade Subscription mit Limit
    const [subscription] = await db.promise().query(
      `SELECT max_members, status FROM dojo_subscriptions WHERE dojo_id = ?`,
      [dojoId]
    );

    if (subscription.length === 0 || subscription[0].status !== 'active') {
      return next(); // Kein Limit wenn keine aktive Subscription
    }

    const maxMembers = subscription[0].max_members;

    // Z\u00e4hle aktive Mitglieder
    const [count] = await db.promise().query(
      `SELECT COUNT(*) as count FROM mitglieder WHERE dojo_id = ? AND aktiv = 1`,
      [dojoId]
    );

    const currentMembers = count[0].count;

    if (currentMembers >= maxMembers) {
      return res.status(403).json({
        error: `Mitgliederlimit erreicht (${currentMembers}/${maxMembers})`,
        current_members: currentMembers,
        max_members: maxMembers,
        message: 'Upgraden Sie Ihren Plan um mehr Mitglieder hinzuzuf\u00fcgen.',
        upgrade_url: '/upgrade'
      });
    }

    req.memberLimit = { current: currentMembers, max: maxMembers };
    next();

  } catch (error) {
    console.error('Fehler bei Member-Limit-Check:', error);
    next(); // Bei Fehler durchlassen (fail-open)
  }
}

/**
 * Middleware: Pr\u00fcft Storage-Limit
 */
async function checkStorageLimit(req, res, next) {
  try {
    const dojoId = req.user?.dojo_id;
    const fileSize = req.file?.size || 0; // Multer file size in bytes

    if (!dojoId || fileSize === 0) {
      return next();
    }

    const [subscription] = await db.promise().query(
      `SELECT current_storage_mb, storage_limit_mb FROM dojo_subscriptions WHERE dojo_id = ?`,
      [dojoId]
    );

    if (subscription.length === 0) {
      return next();
    }

    const currentStorageMB = subscription[0].current_storage_mb || 0;
    const limitMB = subscription[0].storage_limit_mb || 1000;
    const fileSizeMB = fileSize / (1024 * 1024);

    if ((currentStorageMB + fileSizeMB) > limitMB) {
      return res.status(403).json({
        error: 'Speicherlimit erreicht',
        current_storage_mb: currentStorageMB.toFixed(2),
        file_size_mb: fileSizeMB.toFixed(2),
        storage_limit_mb: limitMB,
        message: 'Bitte l\u00f6schen Sie alte Dateien oder upgraden Sie Ihren Plan.',
        upgrade_url: '/upgrade'
      });
    }

    next();

  } catch (error) {
    console.error('Fehler bei Storage-Limit-Check:', error);
    next();
  }
}

module.exports = {
  requireFeature,
  checkMemberLimit,
  checkStorageLimit
};
