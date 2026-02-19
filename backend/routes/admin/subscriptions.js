/**
 * Admin Subscription Routes
 * Trial & Subscription Management
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');

// PUT /dojos/:id/extend-trial - Trial verlängern
router.put('/dojos/:id/extend-trial', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Ungültige Anzahl Tage', message: 'Tage müssen zwischen 1 und 365 liegen' });
    }

    const [dojos] = await db.promise().query('SELECT id, dojoname, subscription_status, trial_ends_at FROM dojo WHERE id = ?', [id]);
    if (dojos.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    const dojo = dojos[0];
    const newTrialEndDate = new Date(dojo.trial_ends_at || new Date());
    newTrialEndDate.setDate(newTrialEndDate.getDate() + parseInt(days));

    await db.promise().query(`UPDATE dojo SET trial_ends_at = ?, subscription_status = 'trial' WHERE id = ?`, [newTrialEndDate, id]);

    logger.info('Trial verlängert:', { dojoname: dojo.dojoname, days });
    res.json({
      success: true, message: `Trial erfolgreich um ${days} Tage verlängert`,
      dojo_id: id, dojoname: dojo.dojoname, new_trial_ends_at: newTrialEndDate, days_added: days
    });
  } catch (error) {
    logger.error('Fehler beim Verlängern des Trials:', error);
    res.status(500).json({ error: 'Fehler beim Verlängern des Trials', details: error.message });
  }
});

// PUT /dojos/:id/activate-subscription - Abo aktivieren
router.put('/dojos/:id/activate-subscription', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, interval, duration_months, is_free, custom_price, custom_notes } = req.body;

    const validPlans = ['starter', 'professional', 'premium', 'enterprise', 'free', 'custom'];
    const validIntervals = ['monthly', 'quarterly', 'yearly'];

    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Ungültiger Plan', message: 'Plan muss starter, professional, premium, enterprise, free oder custom sein' });
    }

    // Free Account
    if (plan === 'free' || is_free) {
      const [dojos] = await db.promise().query('SELECT id, dojoname FROM dojo WHERE id = ?', [id]);
      if (dojos.length === 0) return res.status(404).json({ error: 'Dojo nicht gefunden' });

      await db.promise().query(`
        UPDATE dojo SET subscription_status = 'active', subscription_plan = 'free',
          payment_interval = NULL, subscription_started_at = NOW(), subscription_ends_at = NULL, last_payment_at = NOW()
        WHERE id = ?
      `, [id]);

      logger.info('KOSTENLOSER Account aktiviert:', { dojoname: dojos[0].dojoname });
      return res.json({ success: true, message: 'Kostenloser Account aktiviert', dojo_id: id, dojoname: dojos[0].dojoname, subscription_plan: 'free', is_lifetime: true });
    }

    if (!interval || !validIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Ungültiges Intervall', message: 'Intervall muss monthly, quarterly oder yearly sein' });
    }

    const months = parseInt(duration_months) || 1;
    if (months < 1 || months > 60) {
      return res.status(400).json({ error: 'Ungültige Dauer', message: 'Dauer muss zwischen 1 und 60 Monaten liegen' });
    }

    const [dojos] = await db.promise().query('SELECT id, dojoname FROM dojo WHERE id = ?', [id]);
    if (dojos.length === 0) return res.status(404).json({ error: 'Dojo nicht gefunden' });

    const subscriptionStartDate = new Date();
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);

    await db.promise().query(`
      UPDATE dojo SET subscription_status = 'active', subscription_plan = ?, payment_interval = ?,
        subscription_started_at = ?, subscription_ends_at = ?, last_payment_at = NOW()
      WHERE id = ?
    `, [plan, interval, subscriptionStartDate, subscriptionEndDate, id]);

    logger.info('Abonnement aktiviert:', { dojoname: dojos[0].dojoname, plan, months });
    res.json({
      success: true, message: 'Abonnement erfolgreich aktiviert',
      dojo_id: id, dojoname: dojos[0].dojoname, subscription_plan: plan, payment_interval: interval,
      subscription_started_at: subscriptionStartDate, subscription_ends_at: subscriptionEndDate,
      duration_months: months, ...(plan === 'custom' && { custom_price, custom_notes })
    });
  } catch (error) {
    logger.error('Fehler beim Aktivieren des Abonnements:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren des Abonnements', details: error.message });
  }
});

// PUT /dojos/:id/subscription-status - Status ändern
router.put('/dojos/:id/subscription-status', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['trial', 'active', 'expired', 'cancelled', 'suspended'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status', message: 'Status muss trial, active, expired, cancelled oder suspended sein' });
    }

    const [dojos] = await db.promise().query('SELECT id, dojoname, subscription_status FROM dojo WHERE id = ?', [id]);
    if (dojos.length === 0) return res.status(404).json({ error: 'Dojo nicht gefunden' });

    await db.promise().query('UPDATE dojo SET subscription_status = ? WHERE id = ?', [status, id]);

    logger.info('Status geändert:', { dojoname: dojos[0].dojoname, oldStatus: dojos[0].subscription_status, newStatus: status });
    res.json({
      success: true, message: 'Status erfolgreich geändert',
      dojo_id: id, dojoname: dojos[0].dojoname, old_status: dojos[0].subscription_status, new_status: status
    });
  } catch (error) {
    logger.error('Fehler beim Ändern des Status:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Status', details: error.message });
  }
});

// GET /features - Alle Feature-Definitionen laden
router.get('/features', requireSuperAdmin, async (req, res) => {
  try {
    await db.promise().query('SET NAMES utf8mb4');
    const [features] = await db.promise().query(
      `SELECT feature_id as id, feature_key, feature_name as label,
              feature_icon as emoji, feature_description as description
       FROM plan_features
       WHERE is_active = 1
       ORDER BY sort_order`
    );

    // Feature-Key als ID verwenden für Kompatibilität mit Frontend
    const formattedFeatures = features.map(f => ({
      id: f.feature_key,
      label: f.label,
      emoji: f.emoji || '⭐',
      description: f.description || ''
    }));

    res.json({ success: true, features: formattedFeatures });
  } catch (error) {
    logger.error('Fehler beim Laden der Features:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Features' });
  }
});

// GET /plans/features - Alle Plan-Features aus der Datenbank laden
router.get('/plans/features', requireSuperAdmin, async (req, res) => {
  logger.info('GET /admin/plans/features aufgerufen');
  try {
    // Alle Pläne mit ihren Features laden
    const [plans] = await db.promise().query(
      'SELECT plan_id, plan_name FROM subscription_plans ORDER BY sort_order'
    );

    const [mappings] = await db.promise().query(`
      SELECT sp.plan_name, pf.feature_key
      FROM plan_feature_mapping pfm
      JOIN subscription_plans sp ON pfm.plan_id = sp.plan_id
      JOIN plan_features pf ON pfm.feature_id = pf.feature_id
    `);

    // Gruppieren nach Plan
    const planFeatures = {};
    plans.forEach(p => {
      planFeatures[p.plan_name] = [];
    });
    mappings.forEach(m => {
      if (planFeatures[m.plan_name]) {
        planFeatures[m.plan_name].push(m.feature_key);
      }
    });

    res.json({ success: true, planFeatures });
  } catch (error) {
    logger.error('Fehler beim Laden der Plan-Features:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Plan-Features' });
  }
});

// GET /subscription-plans - Alle Pläne abrufen
router.get('/subscription-plans', requireSuperAdmin, async (req, res) => {
  try {
    const [plans] = await db.promise().query('SELECT * FROM subscription_plans ORDER BY sort_order ASC');
    res.json({ success: true, plans });
  } catch (error) {
    logger.error('Fehler beim Laden der Pläne:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Pläne' });
  }
});

// PUT /plans/:planName/features - Features für einen Plan aktualisieren
router.put('/plans/:planName/features', requireSuperAdmin, async (req, res) => {
  logger.info('PUT /admin/plans/features aufgerufen:', { planName: req.params.planName, features: req.body.features });
  try {
    const { planName } = req.params;
    const { features } = req.body; // Array von feature_keys (strings wie 'mitgliederverwaltung')

    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'Features muss ein Array sein' });
    }

    // Plan-ID anhand des Namens finden
    const [plans] = await db.promise().query(
      'SELECT plan_id FROM subscription_plans WHERE plan_name = ?',
      [planName]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Plan nicht gefunden', plan_name: planName });
    }

    const planId = plans[0].plan_id;

    // Feature-IDs anhand der Keys finden
    let featureIds = [];
    if (features.length > 0) {
      const [foundFeatures] = await db.promise().query(
        'SELECT feature_id, feature_key FROM plan_features WHERE feature_key IN (?)',
        [features]
      );
      featureIds = foundFeatures.map(f => f.feature_id);
    }

    // Alle existierenden Feature-Mappings für diesen Plan löschen
    await db.promise().query(
      'DELETE FROM plan_feature_mapping WHERE plan_id = ?',
      [planId]
    );

    // Neue Feature-Mappings einfügen
    if (featureIds.length > 0) {
      const values = featureIds.map(featureId => [planId, featureId]);
      await db.promise().query(
        'INSERT INTO plan_feature_mapping (plan_id, feature_id) VALUES ?',
        [values]
      );
    }

    logger.info('Plan-Features aktualisiert:', { planName, planId, featureKeys: features, featureCount: featureIds.length });
    res.json({
      success: true,
      message: `Features für Plan "${planName}" erfolgreich aktualisiert`,
      plan_name: planName,
      feature_count: featureIds.length,
      features_requested: features.length,
      features_mapped: featureIds.length
    });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Plan-Features:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Plan-Features', details: error.message });
  }
});

// PUT /subscription-plans/:id - Plan aktualisieren
router.put('/subscription-plans/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      display_name, description, price_monthly, price_yearly,
      feature_verkauf, feature_buchfuehrung, feature_events, feature_multidojo, feature_api,
      max_members, max_dojos, storage_limit_mb, is_visible
    } = req.body;

    logger.info('PUT /subscription-plans/:id aufgerufen:', { plan_id: id, body: req.body });

    // Nur die Felder aktualisieren die auch gesendet wurden
    const updates = [];
    const values = [];

    if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (price_monthly !== undefined) { updates.push('price_monthly = ?'); values.push(price_monthly); }
    if (price_yearly !== undefined) { updates.push('price_yearly = ?'); values.push(price_yearly); }
    if (feature_verkauf !== undefined) { updates.push('feature_verkauf = ?'); values.push(feature_verkauf ? 1 : 0); }
    if (feature_buchfuehrung !== undefined) { updates.push('feature_buchfuehrung = ?'); values.push(feature_buchfuehrung ? 1 : 0); }
    if (feature_events !== undefined) { updates.push('feature_events = ?'); values.push(feature_events ? 1 : 0); }
    if (feature_multidojo !== undefined) { updates.push('feature_multidojo = ?'); values.push(feature_multidojo ? 1 : 0); }
    if (feature_api !== undefined) { updates.push('feature_api = ?'); values.push(feature_api ? 1 : 0); }
    if (max_members !== undefined) { updates.push('max_members = ?'); values.push(max_members); }
    if (max_dojos !== undefined) { updates.push('max_dojos = ?'); values.push(max_dojos); }
    if (storage_limit_mb !== undefined) { updates.push('storage_limit_mb = ?'); values.push(storage_limit_mb); }
    if (is_visible !== undefined) { updates.push('is_visible = ?'); values.push(is_visible ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE subscription_plans SET ${updates.join(', ')} WHERE plan_id = ?`;
    logger.info('SQL Query:', query, values);

    await db.promise().query(query, values);

    logger.info('Plan aktualisiert:', { id });
    res.json({ success: true, message: 'Plan erfolgreich aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Plans:', error.message);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Plans', details: error.message });
  }
});

// ============================================
// FEATURE TRIALS ADMIN MANAGEMENT
// ============================================

const featureAccessService = require('../../services/featureAccessService');

// GET alle Feature-Trials (alle Dojos)
router.get('/feature-trials', requireSuperAdmin, async (req, res) => {
  try {
    const { status, dojo_id } = req.query;

    let query = `
      SELECT ft.*, pf.feature_name, pf.feature_key, pf.feature_icon,
             d.dojoname, d.subdomain,
             TIMESTAMPDIFF(DAY, NOW(), ft.expires_at) as days_remaining
      FROM feature_trials ft
      JOIN plan_features pf ON pf.feature_id = ft.feature_id
      JOIN dojo d ON d.id = ft.dojo_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND ft.status = ?`;
      params.push(status);
    }

    if (dojo_id) {
      query += ` AND ft.dojo_id = ?`;
      params.push(dojo_id);
    }

    query += ` ORDER BY ft.expires_at ASC`;

    const [trials] = await db.promise().query(query, params);
    res.json({ trials });

  } catch (error) {
    logger.error('Fehler beim Laden der Feature-Trials:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST Feature-Trial für ein Dojo starten (Admin)
router.post('/dojos/:dojoId/feature-trial', requireSuperAdmin, async (req, res) => {
  try {
    const { dojoId } = req.params;
    const { featureId, days } = req.body;
    const adminId = req.user.id;

    if (!featureId) {
      return res.status(400).json({ error: 'Feature ID erforderlich' });
    }

    // Admin kann Trial auch mehrfach starten (überschreibt "bereits getestet")
    const result = await featureAccessService.startFeatureTrial(
      parseInt(dojoId),
      parseInt(featureId),
      adminId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info('Feature-Trial von Admin gestartet:', {
      dojoId,
      featureId,
      adminId,
      trialId: result.trial.trial_id
    });

    res.json({
      success: true,
      trial: result.trial,
      message: result.message
    });

  } catch (error) {
    logger.error('Fehler beim Starten des Feature-Trials:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE Feature-Trial beenden
router.delete('/feature-trials/:trialId', requireSuperAdmin, async (req, res) => {
  try {
    const { trialId } = req.params;
    const { reason } = req.body;

    const result = await featureAccessService.endFeatureTrial(
      parseInt(trialId),
      reason || 'cancelled'
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info('Feature-Trial beendet:', { trialId, reason });
    res.json({ success: true, message: 'Trial beendet' });

  } catch (error) {
    logger.error('Fehler beim Beenden des Feature-Trials:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Feature-Addon-Preise verwalten
router.get('/feature-addon-prices', requireSuperAdmin, async (req, res) => {
  try {
    const [prices] = await db.promise().query(`
      SELECT fap.*, pf.feature_name, pf.feature_key, pf.feature_icon, pf.feature_category
      FROM feature_addon_prices fap
      JOIN plan_features pf ON pf.feature_id = fap.feature_id
      ORDER BY pf.sort_order ASC
    `);

    res.json({ prices });

  } catch (error) {
    logger.error('Fehler beim Laden der Addon-Preise:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT Feature-Addon-Preis aktualisieren
router.put('/feature-addon-prices/:featureId', requireSuperAdmin, async (req, res) => {
  try {
    const { featureId } = req.params;
    const { monthly_price, yearly_price, trial_days, trial_enabled, addon_enabled, upgrade_hint, min_plan_for_upgrade } = req.body;

    await db.promise().query(`
      INSERT INTO feature_addon_prices (feature_id, monthly_price, yearly_price, trial_days, trial_enabled, addon_enabled, upgrade_hint, min_plan_for_upgrade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        monthly_price = VALUES(monthly_price),
        yearly_price = VALUES(yearly_price),
        trial_days = VALUES(trial_days),
        trial_enabled = VALUES(trial_enabled),
        addon_enabled = VALUES(addon_enabled),
        upgrade_hint = VALUES(upgrade_hint),
        min_plan_for_upgrade = VALUES(min_plan_for_upgrade)
    `, [featureId, monthly_price || 9, yearly_price || 90, trial_days || 14, trial_enabled ? 1 : 0, addon_enabled ? 1 : 0, upgrade_hint, min_plan_for_upgrade]);

    logger.info('Addon-Preis aktualisiert:', { featureId });
    res.json({ success: true, message: 'Addon-Preis aktualisiert' });

  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Addon-Preises:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST Abgelaufene Trials verarbeiten (manuell oder via Cronjob)
router.post('/process-expired-trials', requireSuperAdmin, async (req, res) => {
  try {
    const result = await featureAccessService.processExpiredTrials();

    logger.info('Abgelaufene Trials verarbeitet:', result);
    res.json({
      success: true,
      processed: result.processed,
      trials: result.trials
    });

  } catch (error) {
    logger.error('Fehler beim Verarbeiten der Trials:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Feature-Trial Statistiken
router.get('/feature-trial-stats', requireSuperAdmin, async (req, res) => {
  try {
    // Aktive Trials
    const [activeTrials] = await db.promise().query(`
      SELECT COUNT(*) as count FROM feature_trials WHERE status = 'active' AND expires_at > NOW()
    `);

    // Trials nach Status
    const [trialsByStatus] = await db.promise().query(`
      SELECT status, COUNT(*) as count FROM feature_trials GROUP BY status
    `);

    // Conversion Rate (Trial -> Addon oder Plan-Upgrade)
    const [conversions] = await db.promise().query(`
      SELECT
        COUNT(*) as total_completed,
        SUM(CASE WHEN converted_to_addon_id IS NOT NULL OR converted_to_plan IS NOT NULL THEN 1 ELSE 0 END) as converted
      FROM feature_trials
      WHERE status IN ('expired', 'converted')
    `);

    // Top getestete Features
    const [topFeatures] = await db.promise().query(`
      SELECT pf.feature_name, pf.feature_icon, COUNT(*) as trial_count
      FROM feature_trials ft
      JOIN plan_features pf ON pf.feature_id = ft.feature_id
      GROUP BY ft.feature_id
      ORDER BY trial_count DESC
      LIMIT 10
    `);

    // Expiring soon (nächste 7 Tage)
    const [expiringSoon] = await db.promise().query(`
      SELECT COUNT(*) as count FROM feature_trials
      WHERE status = 'active' AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
    `);

    res.json({
      activeTrials: activeTrials[0].count,
      trialsByStatus,
      conversionRate: conversions[0].total_completed > 0
        ? ((conversions[0].converted / conversions[0].total_completed) * 100).toFixed(1)
        : 0,
      topFeatures,
      expiringSoon: expiringSoon[0].count
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Trial-Statistiken:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
