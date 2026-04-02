/**
 * Feature Access Service
 *
 * Zentrale Logik für Feature-Zugriffsprüfung:
 * 1. Ist Feature im aktuellen Plan enthalten?
 * 2. Oder gibt es einen aktiven Feature-Trial?
 * 3. Oder gibt es ein aktives Feature-Addon?
 *
 * Diese Prüfung ist DYNAMISCH - wenn Features einem anderen Plan
 * zugeordnet werden, funktioniert alles weiterhin korrekt.
 */

const db = require('../db');

/**
 * Prüft ob ein Dojo Zugriff auf ein Feature hat
 * @param {number} dojoId - Die Dojo ID
 * @param {string} featureKey - Der Feature-Schlüssel (z.B. 'verkauf', 'buchfuehrung')
 * @returns {Object} { hasAccess: boolean, accessType: 'plan'|'trial'|'addon'|'none', details: {...} }
 */
async function hasFeatureAccess(dojoId, featureKey) {
  try {
    // 1. Feature-ID ermitteln
    const [features] = await db.promise().query(
      `SELECT feature_id, feature_name FROM plan_features WHERE feature_key = ? AND is_active = 1`,
      [featureKey]
    );

    if (features.length === 0) {
      return { hasAccess: false, accessType: 'none', reason: 'Feature existiert nicht' };
    }

    const featureId = features[0].feature_id;
    const featureName = features[0].feature_name;

    // 2. Dojo-Subscription und Plan ermitteln
    const [subs] = await db.promise().query(
      `SELECT ds.subscription_id, ds.plan_type, ds.status,
              sp.plan_id
       FROM dojo_subscriptions ds
       LEFT JOIN subscription_plans sp ON sp.plan_name = ds.plan_type
       WHERE ds.dojo_id = ?`,
      [dojoId]
    );

    if (subs.length === 0) {
      return { hasAccess: false, accessType: 'none', reason: 'Keine Subscription gefunden' };
    }

    const subscription = subs[0];
    const planId = subscription.plan_id;

    // 3. Check: Ist Feature im aktuellen Plan enthalten?
    if (planId) {
      const [planFeatures] = await db.promise().query(
        `SELECT is_included FROM plan_feature_mapping
         WHERE plan_id = ? AND feature_id = ? AND is_included = 1`,
        [planId, featureId]
      );

      if (planFeatures.length > 0) {
        return {
          hasAccess: true,
          accessType: 'plan',
          details: {
            planType: subscription.plan_type,
            featureId,
            featureName
          }
        };
      }
    }

    // 4. Check: Gibt es einen aktiven Feature-Trial?
    const [trials] = await db.promise().query(
      `SELECT trial_id, started_at, expires_at,
              TIMESTAMPDIFF(DAY, NOW(), expires_at) as days_remaining
       FROM feature_trials
       WHERE dojo_id = ? AND feature_id = ? AND status = 'active' AND expires_at > NOW()`,
      [dojoId, featureId]
    );

    if (trials.length > 0) {
      const trial = trials[0];
      return {
        hasAccess: true,
        accessType: 'trial',
        details: {
          trialId: trial.trial_id,
          startedAt: trial.started_at,
          expiresAt: trial.expires_at,
          daysRemaining: Math.max(0, trial.days_remaining),
          featureId,
          featureName
        }
      };
    }

    // 5. Check: Gibt es ein aktives Feature-Addon?
    const [addons] = await db.promise().query(
      `SELECT addon_id, started_at, expires_at, monthly_price
       FROM feature_addons
       WHERE dojo_id = ? AND feature_id = ? AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [dojoId, featureId]
    );

    if (addons.length > 0) {
      const addon = addons[0];
      return {
        hasAccess: true,
        accessType: 'addon',
        details: {
          addonId: addon.addon_id,
          startedAt: addon.started_at,
          expiresAt: addon.expires_at,
          monthlyPrice: addon.monthly_price,
          featureId,
          featureName
        }
      };
    }

    // 6. Kein Zugriff - ermittle Upgrade-Optionen
    const upgradeInfo = await getUpgradeOptionsForFeature(featureId, subscription.plan_type);

    return {
      hasAccess: false,
      accessType: 'none',
      reason: 'Feature nicht im Plan enthalten',
      details: {
        currentPlan: subscription.plan_type,
        featureId,
        featureName,
        ...upgradeInfo
      }
    };

  } catch (error) {
    console.error('Feature access check error:', error);
    return { hasAccess: false, accessType: 'none', reason: 'Fehler bei Prüfung' };
  }
}

/**
 * Ermittelt alle Features eines Dojos mit Zugriffsstatus
 * @param {number} dojoId - Die Dojo ID
 * @returns {Array} Liste aller Features mit Zugriffsstatus
 */
async function getAllFeaturesWithAccess(dojoId) {
  try {
    // Dojo-Subscription und Plan ermitteln
    const [subs] = await db.promise().query(
      `SELECT ds.subscription_id, ds.plan_type, ds.status,
              sp.plan_id
       FROM dojo_subscriptions ds
       LEFT JOIN subscription_plans sp ON sp.plan_name = ds.plan_type
       WHERE ds.dojo_id = ?`,
      [dojoId]
    );

    if (subs.length === 0) {
      return [];
    }

    const subscription = subs[0];
    const planId = subscription.plan_id;

    // Alle aktiven Features laden
    const [allFeatures] = await db.promise().query(
      `SELECT pf.feature_id, pf.feature_key, pf.feature_name, pf.feature_icon,
              pf.feature_description, pf.feature_category, pf.can_be_addon, pf.can_be_trialed,
              fap.monthly_price, fap.yearly_price, fap.trial_days, fap.trial_enabled,
              fap.addon_enabled, fap.min_plan_for_upgrade, fap.upgrade_hint
       FROM plan_features pf
       LEFT JOIN feature_addon_prices fap ON fap.feature_id = pf.feature_id
       WHERE pf.is_active = 1
       ORDER BY pf.sort_order ASC`
    );

    // Plan-Features laden
    const [planFeatures] = await db.promise().query(
      `SELECT feature_id FROM plan_feature_mapping
       WHERE plan_id = ? AND is_included = 1`,
      [planId || 0]
    );
    const includedInPlan = new Set(planFeatures.map(pf => pf.feature_id));

    // Aktive Trials laden
    const [trials] = await db.promise().query(
      `SELECT feature_id, trial_id, expires_at,
              TIMESTAMPDIFF(DAY, NOW(), expires_at) as days_remaining
       FROM feature_trials
       WHERE dojo_id = ? AND status = 'active' AND expires_at > NOW()`,
      [dojoId]
    );
    const trialMap = new Map(trials.map(t => [t.feature_id, t]));

    // Aktive Addons laden
    const [addons] = await db.promise().query(
      `SELECT feature_id, addon_id, monthly_price
       FROM feature_addons
       WHERE dojo_id = ? AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [dojoId]
    );
    const addonMap = new Map(addons.map(a => [a.feature_id, a]));

    // Bereits verwendete Trials laden (für "bereits getestet" Info)
    const [usedTrials] = await db.promise().query(
      `SELECT feature_id, MAX(expires_at) as last_trial_ended
       FROM feature_trials
       WHERE dojo_id = ? AND status IN ('expired', 'converted', 'cancelled')
       GROUP BY feature_id`,
      [dojoId]
    );
    const usedTrialMap = new Map(usedTrials.map(t => [t.feature_id, t.last_trial_ended]));

    // Features mit Zugriffsstatus anreichern
    return allFeatures.map(feature => {
      const featureId = feature.feature_id;

      // Zugriffsstatus bestimmen
      let hasAccess = false;
      let accessType = 'none';
      let accessDetails = null;

      if (includedInPlan.has(featureId)) {
        hasAccess = true;
        accessType = 'plan';
      } else if (trialMap.has(featureId)) {
        hasAccess = true;
        accessType = 'trial';
        accessDetails = trialMap.get(featureId);
      } else if (addonMap.has(featureId)) {
        hasAccess = true;
        accessType = 'addon';
        accessDetails = addonMap.get(featureId);
      }

      // Trial-Verfügbarkeit prüfen
      const hadTrialBefore = usedTrialMap.has(featureId);
      const canStartTrial = !hasAccess && feature.trial_enabled && feature.can_be_trialed && !hadTrialBefore;
      const canBuyAddon = !hasAccess && feature.addon_enabled && feature.can_be_addon;

      return {
        ...feature,
        hasAccess,
        accessType,
        accessDetails,
        currentPlan: subscription.plan_type,

        // Trial-Info
        canStartTrial,
        hadTrialBefore,
        lastTrialEnded: usedTrialMap.get(featureId) || null,
        trialDays: feature.trial_days || 14,

        // Addon-Info
        canBuyAddon,
        addonMonthlyPrice: feature.monthly_price || 9.00,
        addonYearlyPrice: feature.yearly_price || 90.00,

        // Upgrade-Info
        upgradeHint: feature.upgrade_hint,
        minPlanForUpgrade: feature.min_plan_for_upgrade
      };
    });

  } catch (error) {
    console.error('Get all features error:', error);
    return [];
  }
}

/**
 * Startet einen Feature-Trial für ein Dojo
 * @param {number} dojoId - Die Dojo ID
 * @param {number} featureId - Die Feature ID
 * @param {number} adminId - (Optional) Admin der Trial startet
 * @returns {Object} { success: boolean, trial: {...}, error: string }
 */
async function startFeatureTrial(dojoId, featureId, adminId = null) {
  try {
    // Prüfe ob Trial erlaubt
    const [features] = await db.promise().query(
      `SELECT pf.feature_id, pf.feature_name, pf.can_be_trialed,
              fap.trial_enabled, fap.trial_days
       FROM plan_features pf
       LEFT JOIN feature_addon_prices fap ON fap.feature_id = pf.feature_id
       WHERE pf.feature_id = ?`,
      [featureId]
    );

    if (features.length === 0) {
      return { success: false, error: 'Feature nicht gefunden' };
    }

    const feature = features[0];

    if (!feature.can_be_trialed || !feature.trial_enabled) {
      return { success: false, error: 'Trial für dieses Feature nicht verfügbar' };
    }

    // Prüfe ob bereits Trial genutzt (nur einmal pro Feature)
    const [existingTrials] = await db.promise().query(
      `SELECT trial_id, status FROM feature_trials
       WHERE dojo_id = ? AND feature_id = ?`,
      [dojoId, featureId]
    );

    const hadTrial = existingTrials.some(t =>
      t.status === 'expired' || t.status === 'converted' || t.status === 'cancelled'
    );

    if (hadTrial && !adminId) {
      return { success: false, error: 'Trial für dieses Feature bereits verwendet' };
    }

    // Prüfe ob aktiver Trial existiert
    const hasActiveTrial = existingTrials.some(t => t.status === 'active');
    if (hasActiveTrial) {
      return { success: false, error: 'Bereits aktiver Trial für dieses Feature' };
    }

    // Trial erstellen
    const trialDays = feature.trial_days || 14;
    const [result] = await db.promise().query(
      `INSERT INTO feature_trials
       (dojo_id, feature_id, expires_at, started_by_admin_id)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [dojoId, featureId, trialDays, adminId]
    );

    // Trial-Daten laden
    const [newTrial] = await db.promise().query(
      `SELECT * FROM feature_trials WHERE trial_id = ?`,
      [result.insertId]
    );

    return {
      success: true,
      trial: newTrial[0],
      message: `${trialDays}-Tage Trial für "${feature.feature_name}" gestartet`
    };

  } catch (error) {
    console.error('Start trial error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Beendet einen Feature-Trial
 * @param {number} trialId - Die Trial ID
 * @param {string} reason - Grund (expired, converted, cancelled)
 */
async function endFeatureTrial(trialId, reason = 'expired') {
  try {
    await db.promise().query(
      `UPDATE feature_trials
       SET status = ?, cancelled_at = NOW()
       WHERE trial_id = ?`,
      [reason, trialId]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Ermittelt Upgrade-Optionen für ein Feature
 */
async function getUpgradeOptionsForFeature(featureId, currentPlan) {
  try {
    // Finde Pläne die dieses Feature enthalten
    const [plansWithFeature] = await db.promise().query(
      `SELECT sp.plan_name, sp.display_name, sp.price_monthly, sp.price_yearly, sp.sort_order
       FROM subscription_plans sp
       JOIN plan_feature_mapping pfm ON pfm.plan_id = sp.plan_id
       WHERE pfm.feature_id = ? AND pfm.is_included = 1 AND sp.is_visible = 1
       ORDER BY sp.sort_order ASC`,
      [featureId]
    );

    // Addon-Preis laden
    const [addonPrices] = await db.promise().query(
      `SELECT monthly_price, yearly_price, addon_enabled, upgrade_hint
       FROM feature_addon_prices WHERE feature_id = ?`,
      [featureId]
    );

    return {
      availableInPlans: plansWithFeature,
      lowestPlan: plansWithFeature[0] || null,
      addonPrice: addonPrices[0] || { monthly_price: 9, yearly_price: 90, addon_enabled: true },
      upgradeHint: addonPrices[0]?.upgrade_hint || null
    };

  } catch (error) {
    return { availableInPlans: [], lowestPlan: null, addonPrice: null };
  }
}

/**
 * Verarbeitet abgelaufene Trials (für Cronjob)
 */
async function processExpiredTrials() {
  try {
    // Alle abgelaufenen aktiven Trials finden
    const [expiredTrials] = await db.promise().query(
      `SELECT ft.trial_id, ft.dojo_id, ft.feature_id, ft.expires_at,
              pf.feature_name, d.dojoname
       FROM feature_trials ft
       JOIN plan_features pf ON pf.feature_id = ft.feature_id
       JOIN dojo d ON d.id = ft.dojo_id
       WHERE ft.status = 'active' AND ft.expires_at < NOW()`
    );

    console.log(`Processing ${expiredTrials.length} expired trials...`);

    for (const trial of expiredTrials) {
      // Status auf 'expired' setzen
      await db.promise().query(
        `UPDATE feature_trials SET status = 'expired' WHERE trial_id = ?`,
        [trial.trial_id]
      );

      // Optional: Notification senden
      // await sendTrialExpiredNotification(trial);
    }

    return { processed: expiredTrials.length, trials: expiredTrials };

  } catch (error) {
    console.error('Process expired trials error:', error);
    return { processed: 0, error: error.message };
  }
}

/**
 * Sendet Trial-Reminder (für Cronjob)
 */
async function sendTrialReminders() {
  try {
    // 7 Tage Reminder
    const [trials7d] = await db.promise().query(
      `SELECT ft.*, pf.feature_name, d.dojoname
       FROM feature_trials ft
       JOIN plan_features pf ON pf.feature_id = ft.feature_id
       JOIN dojo d ON d.id = ft.dojo_id
       WHERE ft.status = 'active'
       AND ft.reminder_7d_sent = 0
       AND ft.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)`
    );

    for (const trial of trials7d) {
      // Notification senden
      await db.promise().query(
        `UPDATE feature_trials SET reminder_7d_sent = 1 WHERE trial_id = ?`,
        [trial.trial_id]
      );
    }

    // 3 Tage Reminder
    const [trials3d] = await db.promise().query(
      `SELECT ft.*, pf.feature_name, d.dojoname
       FROM feature_trials ft
       JOIN plan_features pf ON pf.feature_id = ft.feature_id
       JOIN dojo d ON d.id = ft.dojo_id
       WHERE ft.status = 'active'
       AND ft.reminder_3d_sent = 0
       AND ft.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)`
    );

    for (const trial of trials3d) {
      await db.promise().query(
        `UPDATE feature_trials SET reminder_3d_sent = 1 WHERE trial_id = ?`,
        [trial.trial_id]
      );
    }

    // 1 Tag Reminder
    const [trials1d] = await db.promise().query(
      `SELECT ft.*, pf.feature_name, d.dojoname
       FROM feature_trials ft
       JOIN plan_features pf ON pf.feature_id = ft.feature_id
       JOIN dojo d ON d.id = ft.dojo_id
       WHERE ft.status = 'active'
       AND ft.reminder_1d_sent = 0
       AND ft.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 DAY)`
    );

    for (const trial of trials1d) {
      await db.promise().query(
        `UPDATE feature_trials SET reminder_1d_sent = 1 WHERE trial_id = ?`,
        [trial.trial_id]
      );
    }

    return {
      reminders7d: trials7d.length,
      reminders3d: trials3d.length,
      reminders1d: trials1d.length
    };

  } catch (error) {
    console.error('Send trial reminders error:', error);
    return { error: error.message };
  }
}

module.exports = {
  hasFeatureAccess,
  getAllFeaturesWithAccess,
  startFeatureTrial,
  endFeatureTrial,
  getUpgradeOptionsForFeature,
  processExpiredTrials,
  sendTrialReminders
};
