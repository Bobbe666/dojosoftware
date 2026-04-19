const db = require('../db');
const logger = require('../utils/logger');

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
      logger.debug('Feature Check Debug:', {
        feature: featureName,
        userId,
        username: req.user?.username,
        isSuperAdmin,
        userObject: req.user
      });

      if (isSuperAdmin) {
        logger.info('Super-Admin Bypass für Feature:', { details: featureName });
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
                s.feature_kontoauszug,
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
      // feature_key → dojo_subscriptions Spaltenname
      const featureColumnMap = {
        verkauf:          'feature_verkauf',
        buchfuehrung:     'feature_buchfuehrung',
        finanzcockpit:    'feature_buchfuehrung',   // Alias
        events:           'feature_events',
        multidojo:        'feature_multidojo',
        api:              'feature_api',
        kontoauszug:      'feature_kontoauszug',    // Enterprise: Bank-Import + EÜR
        bank_import:      'feature_kontoauszug',    // Alias
        messenger:        'feature_messenger',
        homepage_builder: 'feature_homepage_builder',
        gutscheine:       'feature_gutscheine',
      };

      const featureColumn = featureColumnMap[featureName];

      let hasFeature = false;

      if (featureColumn) {
        // Bekanntes Feature: direkt aus dojo_subscriptions prüfen
        hasFeature = sub[featureColumn] === 1 || sub[featureColumn] === true;
      } else {
        // Unbekanntes Feature: gegen plan_feature_mapping prüfen
        const [rows] = await db.promise().query(
          `SELECT 1 FROM plan_feature_mapping pfm
           JOIN subscription_plans sp ON sp.plan_id = pfm.plan_id
           JOIN plan_features pf ON pf.feature_id = pfm.feature_id
           WHERE sp.plan_name = ? AND pf.feature_key = ? AND pfm.is_included = 1
           LIMIT 1`,
          [sub.plan_type, featureName]
        );
        hasFeature = rows.length > 0;
      }

      if (!hasFeature) {
        return res.status(403).json({
          error: `Feature "${featureName}" ist in deinem Plan "${sub.plan_type}" nicht enthalten`,
          feature_required: featureName,
          current_plan: sub.plan_type,
          upgrade_url: '/upgrade',
          message: `Upgraden auf einen höheren Plan um "${featureName}" zu nutzen.`
        });
      }

      // Feature verf\u00fcgbar - speichere Subscription-Info in Request
      req.subscription = sub;
      next();

    } catch (error) {
      logger.error('Fehler bei Feature-Check:', { error: error });
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
    logger.error('Fehler bei Member-Limit-Check:', { error: error });
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
    logger.error('Fehler bei Storage-Limit-Check:', { error: error });
    next();
  }
}

/**
 * Setzt dojo_subscriptions.feature_* Flags anhand von plan_feature_mapping.
 * Wird bei jedem Plan-Wechsel aufgerufen — ist die einzige Source of Truth.
 *
 * @param {number} dojoId
 * @param {string} planName       z.B. 'starter', 'professional', 'premium', 'enterprise'
 * @param {object} [options]
 * @param {boolean} [options.updatePlanType=true]
 *   false = nur feature_* aktualisieren, plan_type in dojo_subscriptions NICHT ändern
 *   (wird beim Onboarding benutzt: plan_type bleibt 'trial', Features kommen vom gewählten Plan)
 */
async function syncPlanFeatures(dojoId, planName, { updatePlanType = true } = {}) {
  try {
    // feature_key → dojo_subscriptions Spaltenname
    const COLUMN_MAP = {
      verkauf:          'feature_verkauf',
      buchfuehrung:     'feature_buchfuehrung',
      finanzcockpit:    'feature_buchfuehrung',   // Alias
      events:           'feature_events',
      multidojo:        'feature_multidojo',
      api:              'feature_api',
      kontoauszug:      'feature_kontoauszug',    // Alias
      bank_import:      'feature_kontoauszug',
      messenger:        'feature_messenger',
      homepage_builder: 'feature_homepage_builder',
    };

    // Trial = alle Features freischalten (volle Testphase)
    const effectivePlan = planName === 'trial' ? 'enterprise' : planName;

    // Alle im Plan enthaltenen Feature-Keys laden
    const [rows] = await db.promise().query(
      `SELECT pf.feature_key
       FROM plan_feature_mapping pfm
       JOIN subscription_plans sp ON sp.plan_id = pfm.plan_id
       JOIN plan_features pf ON pf.feature_id = pfm.feature_id
       WHERE sp.plan_name = ? AND pfm.is_included = 1`,
      [effectivePlan]
    );

    const includedKeys = new Set(rows.map(r => r.feature_key));

    // Für jede bekannte DB-Spalte: 1 wenn Feature im Plan, sonst 0
    const colUpdates = {};
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      colUpdates[col] = includedKeys.has(key) ? 1 : 0;
    }
    const uniqueCols = [...new Set(Object.keys(colUpdates))];
    const setClauses = uniqueCols.map(col => `${col} = ?`).join(', ');
    const setValues  = uniqueCols.map(col => colUpdates[col]);

    if (updatePlanType) {
      await db.promise().query(
        `UPDATE dojo_subscriptions SET plan_type = ?, ${setClauses} WHERE dojo_id = ?`,
        [planName, ...setValues, dojoId]
      );
    } else {
      await db.promise().query(
        `UPDATE dojo_subscriptions SET ${setClauses} WHERE dojo_id = ?`,
        [...setValues, dojoId]
      );
    }

    logger.info('syncPlanFeatures: Flags gesetzt', {
      dojoId, planName, updatePlanType,
      active: Object.fromEntries(Object.entries(colUpdates).filter(([, v]) => v === 1))
    });
  } catch (err) {
    logger.error('syncPlanFeatures Fehler', { dojoId, planName, error: err.message });
  }
}

module.exports = {
  requireFeature,
  checkMemberLimit,
  checkStorageLimit,
  syncPlanFeatures,
};
