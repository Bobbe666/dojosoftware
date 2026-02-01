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

// PUT /subscription-plans/:id - Plan aktualisieren
router.put('/subscription-plans/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      display_name, description, price_monthly, price_yearly,
      feature_verkauf, feature_buchfuehrung, feature_events, feature_multidojo, feature_api,
      max_members, max_dojos, storage_limit_mb, is_visible
    } = req.body;

    await db.promise().query(`
      UPDATE subscription_plans SET display_name = ?, description = ?, price_monthly = ?, price_yearly = ?,
        feature_verkauf = ?, feature_buchfuehrung = ?, feature_events = ?, feature_multidojo = ?, feature_api = ?,
        max_members = ?, max_dojos = ?, storage_limit_mb = ?, is_visible = ?, updated_at = NOW()
      WHERE plan_id = ?
    `, [display_name, description, price_monthly, price_yearly,
          feature_verkauf ? 1 : 0, feature_buchfuehrung ? 1 : 0, feature_events ? 1 : 0, feature_multidojo ? 1 : 0, feature_api ? 1 : 0,
          max_members, max_dojos, storage_limit_mb, is_visible ? 1 : 0, id]);

    logger.info('Plan aktualisiert:', { id });
    res.json({ success: true, message: 'Plan erfolgreich aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Plans:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Plans' });
  }
});

module.exports = router;
