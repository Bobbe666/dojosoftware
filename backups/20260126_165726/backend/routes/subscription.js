const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * Subscription Management Routes
 * Verwaltet Subscriptions, Upgrades, Downgrades
 */

// Alle Routes ben\u00f6tigen Authentication
router.use(authenticateToken);

// ============================================
// 1. GET CURRENT SUBSCRIPTION
// ============================================
router.get('/current', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;

    const [subscription] = await db.promise().query(
      `SELECT
         s.*,
         d.dojoname as dojo_name,
         d.subdomain,
         p.display_name as plan_display_name,
         p.description as plan_description
       FROM dojo_subscriptions s
       JOIN dojo d ON s.dojo_id = d.id
       LEFT JOIN subscription_plans p ON s.plan_type = p.plan_name
       WHERE s.dojo_id = ?`,
      [dojoId]
    );

    if (subscription.length === 0) {
      return res.status(404).json({
        error: 'Keine Subscription gefunden'
      });
    }

    const sub = subscription[0];

    // Berechne verbleibende Trial-Tage
    let trialDaysLeft = null;
    if (sub.status === 'trial' && sub.trial_ends_at) {
      const now = new Date();
      const trialEnd = new Date(sub.trial_ends_at);
      trialDaysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      trialDaysLeft = Math.max(0, trialDaysLeft);
    }

    // Z\u00e4hle aktive Mitglieder
    const [memberCount] = await db.promise().query(
      `SELECT COUNT(*) as count FROM mitglieder WHERE dojo_id = ? AND aktiv = 1`,
      [dojoId]
    );

    res.json({
      subscription: sub,
      trial_days_left: trialDaysLeft,
      current_members: memberCount[0].count,
      member_limit_reached: memberCount[0].count >= sub.max_members
    });

  } catch (error) {
    console.error('Fehler beim Laden der Subscription:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// 2. GET AVAILABLE PLANS
// ============================================
router.get('/plans', async (req, res) => {
  try {
    const [plans] = await db.promise().query(
      `SELECT * FROM subscription_plans
       WHERE is_visible = TRUE AND is_deprecated = FALSE
       ORDER BY sort_order ASC`
    );

    res.json({ plans });

  } catch (error) {
    console.error('Fehler beim Laden der Pl\u00e4ne:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// 3. UPGRADE/CHANGE PLAN
// ============================================
router.post('/change-plan', async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const dojoId = req.user.dojo_id;
    const { new_plan, billing_interval } = req.body;

    if (!new_plan) {
      throw new Error('Neuer Plan fehlt');
    }

    // Lade aktuellen Plan
    const [currentSub] = await connection.query(
      `SELECT * FROM dojo_subscriptions WHERE dojo_id = ?`,
      [dojoId]
    );

    if (currentSub.length === 0) {
      throw new Error('Keine Subscription gefunden');
    }

    const oldPlan = currentSub[0].plan_type;

    // Lade neuen Plan
    const [newPlanDetails] = await connection.query(
      `SELECT * FROM subscription_plans WHERE plan_name = ? AND is_visible = TRUE`,
      [new_plan]
    );

    if (newPlanDetails.length === 0) {
      throw new Error('Ung\u00fcltiger Plan');
    }

    const plan = newPlanDetails[0];

    // Bestimme Aktion (Upgrade/Downgrade)
    const planOrder = { starter: 1, professional: 2, premium: 3, enterprise: 4 };
    const action = planOrder[new_plan] > planOrder[oldPlan] ? 'upgraded' : 'downgraded';

    // Berechne neuen Preis
    const newPrice = billing_interval === 'yearly' ? plan.price_yearly : plan.price_monthly;
    const newInterval = billing_interval || 'monthly';

    // Update Subscription
    await connection.query(
      `UPDATE dojo_subscriptions SET
         plan_type = ?,
         status = 'active',
         feature_verkauf = ?,
         feature_buchfuehrung = ?,
         feature_events = ?,
         feature_multidojo = ?,
         feature_api = ?,
         max_members = ?,
         max_dojos = ?,
         storage_limit_mb = ?,
         monthly_price = ?,
         billing_interval = ?,
         subscription_starts_at = NOW(),
         trial_ends_at = NULL
       WHERE dojo_id = ?`,
      [
        new_plan,
        plan.feature_verkauf,
        plan.feature_buchfuehrung,
        plan.feature_events,
        plan.feature_multidojo,
        plan.feature_api,
        plan.max_members,
        plan.max_dojos,
        plan.storage_limit_mb,
        newPrice,
        newInterval,
        dojoId
      ]
    );

    // Audit-Log
    await connection.query(
      `INSERT INTO subscription_audit_log
       (subscription_id, dojo_id, action, old_plan, new_plan, changed_by_admin_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        currentSub[0].subscription_id,
        dojoId,
        action,
        oldPlan,
        new_plan,
        req.user.id,
        `Plan ge\u00e4ndert von ${oldPlan} zu ${new_plan}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Plan erfolgreich ge\u00e4ndert von ${oldPlan} zu ${new_plan}`,
      action,
      new_plan,
      new_price: newPrice,
      billing_interval: newInterval
    });

  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Plan-Wechsel:', error);
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// 4. CANCEL SUBSCRIPTION
// ============================================
router.post('/cancel', async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const dojoId = req.user.dojo_id;
    const { reason } = req.body;

    // Update Subscription
    await connection.query(
      `UPDATE dojo_subscriptions SET
         status = 'cancelled',
         cancelled_at = NOW()
       WHERE dojo_id = ?`,
      [dojoId]
    );

    // Audit-Log
    const [sub] = await connection.query(
      `SELECT subscription_id, plan_type FROM dojo_subscriptions WHERE dojo_id = ?`,
      [dojoId]
    );

    await connection.query(
      `INSERT INTO subscription_audit_log
       (subscription_id, dojo_id, action, old_plan, changed_by_admin_id, reason)
       VALUES (?, ?, 'cancelled', ?, ?, ?)`,
      [sub[0].subscription_id, dojoId, sub[0].plan_type, req.user.id, reason || 'Keine Angabe']
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Subscription erfolgreich gek\u00fcndigt',
      cancelled_at: new Date().toISOString()
    });

  } catch (error) {
    await connection.rollback();
    console.error('Fehler bei K\u00fcndigung:', error);
    res.status(500).json({ error: 'Serverfehler bei K\u00fcndigung' });
  } finally {
    connection.release();
  }
});

// ============================================
// 5. REACTIVATE SUBSCRIPTION
// ============================================
router.post('/reactivate', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;

    await db.promise().query(
      `UPDATE dojo_subscriptions SET
         status = 'active',
         cancelled_at = NULL
       WHERE dojo_id = ? AND status = 'cancelled'`,
      [dojoId]
    );

    // Audit-Log
    const [sub] = await db.promise().query(
      `SELECT subscription_id, plan_type FROM dojo_subscriptions WHERE dojo_id = ?`,
      [dojoId]
    );

    await db.promise().query(
      `INSERT INTO subscription_audit_log
       (subscription_id, dojo_id, action, new_plan, changed_by_admin_id, reason)
       VALUES (?, ?, 'reactivated', ?, ?, 'Subscription reaktiviert')`,
      [sub[0].subscription_id, dojoId, sub[0].plan_type, req.user.id]
    );

    res.json({
      success: true,
      message: 'Subscription erfolgreich reaktiviert'
    });

  } catch (error) {
    console.error('Fehler bei Reaktivierung:', error);
    res.status(500).json({ error: 'Serverfehler bei Reaktivierung' });
  }
});

// ============================================
// 6. GET SUBSCRIPTION HISTORY (Audit-Log)
// ============================================
router.get('/history', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;

    const [history] = await db.promise().query(
      `SELECT
         l.*,
         a.name as changed_by_name,
         a.email as changed_by_email
       FROM subscription_audit_log l
       LEFT JOIN admins a ON l.changed_by_admin_id = a.id
       WHERE l.dojo_id = ?
       ORDER BY l.created_at DESC
       LIMIT 50`,
      [dojoId]
    );

    res.json({ history });

  } catch (error) {
    console.error('Fehler beim Laden der History:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
