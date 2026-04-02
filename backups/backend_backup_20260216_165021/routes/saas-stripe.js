/**
 * SaaS Stripe Routes
 * Stripe Integration für DojoSoftware Subscriptions (TDA International)
 *
 * Unterscheidet sich von dojo-spezifischem Stripe:
 * - Nutzt zentralen TDA Stripe Account
 * - Für Software-Subscriptions, nicht für Mitgliedsbeiträge
 */

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { sendSaasNotification, notifyTDAAdmin } = require('../services/saasNotificationService');
const saasSettings = require('../services/saasSettingsService');

// TDA International Dojo ID (Fallback)
const TDA_DOJO_ID = 2;

// Stripe initialisieren - Priorität: saas_settings > env > dojo_banken
const getStripe = async () => {
  // 1. Versuche aus SaaS Settings
  const stripeSettings = await saasSettings.getStripeSettings();
  if (stripeSettings.stripe_secret_key) {
    return {
      stripe: new Stripe(stripeSettings.stripe_secret_key),
      publishableKey: stripeSettings.stripe_publishable_key,
      testMode: stripeSettings.stripe_test_mode
    };
  }

  // 2. Versuche aus Umgebungsvariable
  if (process.env.STRIPE_SAAS_SECRET_KEY) {
    return {
      stripe: new Stripe(process.env.STRIPE_SAAS_SECRET_KEY),
      publishableKey: process.env.STRIPE_SAAS_PUBLISHABLE_KEY,
      testMode: process.env.STRIPE_SAAS_TEST_MODE === 'true'
    };
  }

  // 3. Fallback: dojo_banken für TDA International
  const [banks] = await db.promise().query(
    `SELECT stripe_secret_key, stripe_publishable_key
     FROM dojo_banken
     WHERE dojo_id = ? AND bank_typ = 'stripe' AND ist_aktiv = 1
     ORDER BY ist_standard DESC
     LIMIT 1`,
    [TDA_DOJO_ID]
  );

  if (banks.length === 0 || !banks[0].stripe_secret_key) {
    throw new Error('Stripe nicht konfiguriert - bitte in SaaS-Einstellungen hinterlegen');
  }

  return {
    stripe: new Stripe(banks[0].stripe_secret_key),
    publishableKey: banks[0].stripe_publishable_key,
    testMode: false
  };
};

// Plan-Hierarchie für Upgrade-Prüfung
const PLAN_HIERARCHY = {
  'trial': 0,
  'starter': 1,
  'professional': 2,
  'premium': 3,
  'enterprise': 4
};

// ============================================
// PUBLIC: Stripe Config für Frontend
// ============================================
router.get('/config', async (req, res) => {
  try {
    const { publishableKey } = await getStripe();
    if (!publishableKey) {
      return res.status(500).json({ error: 'Stripe nicht konfiguriert' });
    }
    res.json({ publishableKey });
  } catch (error) {
    logger.error('Stripe Config Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /create-upgrade-checkout
// Erstellt Stripe Checkout Session für Plan-Upgrade
// ============================================
router.post('/create-upgrade-checkout', authenticateToken, async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;
    const { new_plan, billing_interval = 'monthly' } = req.body;

    if (!new_plan) {
      return res.status(400).json({ error: 'Neuer Plan fehlt' });
    }

    // 1. Lade aktuelle Subscription
    const [currentSub] = await db.promise().query(
      `SELECT ds.*, d.dojoname, d.email, d.inhaber
       FROM dojo_subscriptions ds
       JOIN dojo d ON ds.dojo_id = d.id
       WHERE ds.dojo_id = ?`,
      [dojoId]
    );

    if (currentSub.length === 0) {
      return res.status(404).json({ error: 'Keine Subscription gefunden' });
    }

    const sub = currentSub[0];
    const currentPlan = sub.plan_type;

    // 2. Nur Upgrades erlauben
    if (PLAN_HIERARCHY[new_plan] <= PLAN_HIERARCHY[currentPlan]) {
      return res.status(400).json({
        error: 'Nur Upgrades erlaubt',
        message: `Wechsel von ${currentPlan} zu ${new_plan} ist kein Upgrade`
      });
    }

    // 3. Lade neuen Plan mit Stripe Price IDs
    const priceColumn = billing_interval === 'yearly' ? 'stripe_price_yearly' : 'stripe_price_monthly';
    const [planDetails] = await db.promise().query(
      `SELECT *, ${priceColumn} as stripe_price_id
       FROM subscription_plans
       WHERE plan_name = ? AND is_visible = TRUE`,
      [new_plan]
    );

    if (planDetails.length === 0) {
      return res.status(400).json({ error: 'Plan nicht gefunden' });
    }

    const plan = planDetails[0];

    if (!plan.stripe_price_id) {
      return res.status(400).json({
        error: 'Stripe nicht konfiguriert',
        message: `Stripe Price ID für ${new_plan} (${billing_interval}) fehlt`
      });
    }

    // 4. Stripe Checkout Session erstellen
    const { stripe } = await getStripe();

    // Customer finden oder erstellen
    let customerId = sub.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: sub.billing_email || sub.email,
        name: sub.dojoname,
        metadata: {
          dojo_id: dojoId.toString(),
          dojoname: sub.dojoname
        }
      });
      customerId = customer.id;

      // Customer ID speichern
      await db.promise().query(
        'UPDATE dojo_subscriptions SET stripe_customer_id = ? WHERE dojo_id = ?',
        [customerId, dojoId]
      );
    }

    // Checkout Session erstellen
    const baseUrl = process.env.FRONTEND_URL || 'https://dojo.tda-intl.org';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{
        price: plan.stripe_price_id,
        quantity: 1
      }],
      success_url: `${baseUrl}/einstellungen/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/einstellungen/subscription?cancelled=true`,
      metadata: {
        dojo_id: dojoId.toString(),
        old_plan: currentPlan,
        new_plan: new_plan,
        billing_interval: billing_interval
      },
      subscription_data: {
        metadata: {
          dojo_id: dojoId.toString(),
          plan_type: new_plan
        }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto'
      }
    });

    // 5. Audit-Log
    try {
      await db.promise().query(
        `INSERT INTO subscription_audit_log
         (subscription_id, dojo_id, action, old_plan, new_plan, changed_by_admin_id, reason)
         VALUES (?, ?, 'stripe_checkout_started', ?, ?, ?, ?)`,
        [
          sub.subscription_id,
          dojoId,
          currentPlan,
          new_plan,
          req.user.id,
          `Stripe Checkout gestartet für ${new_plan} (${billing_interval})`
        ]
      );
    } catch (auditError) {
      logger.debug('Audit-Log fehlgeschlagen:', auditError.message);
    }

    logger.info('Stripe Checkout Session erstellt:', {
      dojo_id: dojoId,
      dojoname: sub.dojoname,
      old_plan: currentPlan,
      new_plan: new_plan,
      session_id: session.id
    });

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    logger.error('Fehler beim Erstellen der Checkout Session:', error);
    res.status(500).json({
      error: 'Checkout konnte nicht erstellt werden',
      details: error.message
    });
  }
});

// ============================================
// POST /webhook
// Stripe Webhook Handler
// ============================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  // Webhook Secret aus SaaS Settings oder Env-Variable
  const stripeSettings = await saasSettings.getStripeSettings();
  const webhookSecret = stripeSettings.stripe_webhook_secret || process.env.STRIPE_SAAS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('Stripe Webhook Secret nicht konfiguriert (weder in SaaS-Settings noch als Umgebungsvariable)');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    const { stripe } = await getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error('Webhook Signatur-Fehler:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Event in DB speichern
  try {
    await db.promise().query(
      `INSERT INTO saas_payment_events
       (stripe_event_id, event_type, raw_data, created_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE event_type = event_type`,
      [event.id, event.type, JSON.stringify(event)]
    );
  } catch (dbError) {
    logger.debug('Event speichern fehlgeschlagen:', dbError.message);
  }

  // Event verarbeiten
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        logger.debug('Unbehandelter Event-Typ:', event.type);
    }

    // Event als verarbeitet markieren
    await db.promise().query(
      `UPDATE saas_payment_events
       SET processed_at = NOW()
       WHERE stripe_event_id = ?`,
      [event.id]
    );

  } catch (error) {
    logger.error('Fehler bei Event-Verarbeitung:', error);
    // Trotzdem 200 zurückgeben, um Retry-Loops zu vermeiden
  }

  res.json({ received: true });
});

// ============================================
// Webhook Handler Funktionen
// ============================================

async function handleCheckoutCompleted(session) {
  const { dojo_id, old_plan, new_plan, billing_interval } = session.metadata;

  if (!dojo_id || !new_plan) {
    logger.warn('Checkout ohne dojo_id/new_plan:', session.id);
    return;
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // Plan-Details laden
    const [planDetails] = await connection.query(
      'SELECT * FROM subscription_plans WHERE plan_name = ?',
      [new_plan]
    );

    if (planDetails.length === 0) {
      throw new Error('Plan nicht gefunden: ' + new_plan);
    }

    const plan = planDetails[0];
    const interval = billing_interval || 'monthly';
    const newPrice = interval === 'yearly' ? plan.price_yearly : plan.price_monthly;

    // Subscription aktualisieren
    await connection.query(
      `UPDATE dojo_subscriptions SET
         plan_type = ?,
         status = 'active',
         stripe_subscription_id = ?,
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
        session.subscription,
        plan.feature_verkauf,
        plan.feature_buchfuehrung,
        plan.feature_events,
        plan.feature_multidojo,
        plan.feature_api,
        plan.max_members,
        plan.max_dojos,
        plan.storage_limit_mb,
        newPrice,
        interval,
        dojo_id
      ]
    );

    // Audit-Log
    const [subInfo] = await connection.query(
      'SELECT subscription_id FROM dojo_subscriptions WHERE dojo_id = ?',
      [dojo_id]
    );

    await connection.query(
      `INSERT INTO subscription_audit_log
       (subscription_id, dojo_id, action, old_plan, new_plan, reason)
       VALUES (?, ?, 'payment_succeeded', ?, ?, ?)`,
      [
        subInfo[0]?.subscription_id || 0,
        dojo_id,
        old_plan,
        new_plan,
        `Stripe Checkout abgeschlossen. Session: ${session.id}`
      ]
    );

    // Event updaten
    await connection.query(
      `UPDATE saas_payment_events
       SET dojo_id = ?, stripe_customer_id = ?, stripe_subscription_id = ?, status = 'completed'
       WHERE stripe_event_id = ?`,
      [dojo_id, session.customer, session.subscription, session.id]
    );

    await connection.commit();

    logger.info('Plan-Upgrade erfolgreich:', {
      dojo_id,
      old_plan,
      new_plan,
      stripe_session: session.id
    });

    // Dojo-Daten für Benachrichtigungen laden
    const [dojoData] = await db.promise().query(
      'SELECT dojoname, email, inhaber, subdomain FROM dojo WHERE id = ?',
      [dojo_id]
    );

    if (dojoData.length > 0) {
      const dojo = dojoData[0];
      const price = interval === 'yearly' ? plan.price_yearly : plan.price_monthly;

      // Email an Dojo-Besitzer senden
      sendSaasNotification('paymentSuccess', {
        dojo_id: dojo_id,
        dojoname: dojo.dojoname,
        email: dojo.email,
        inhaber: dojo.inhaber,
        subdomain: dojo.subdomain,
        planName: plan.display_name || new_plan,
        price: price,
        interval: interval
      }).catch(err => logger.warn('Dojo-Benachrichtigung fehlgeschlagen:', err.message));

      // Admin-Benachrichtigung
      notifyTDAAdmin('adminUpgradeNotification', {
        dojoname: dojo.dojoname,
        inhaber: dojo.inhaber,
        oldPlan: old_plan || 'trial',
        planName: plan.display_name || new_plan,
        price: price,
        interval: interval
      }).catch(err => logger.warn('Admin-Benachrichtigung fehlgeschlagen:', err.message));
    }

  } catch (error) {
    await connection.rollback();
    logger.error('Fehler bei Checkout-Verarbeitung:', error);
    throw error;
  } finally {
    connection.release();
  }
}

async function handleInvoicePaid(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Dojo finden
  const [subs] = await db.promise().query(
    'SELECT dojo_id FROM dojo_subscriptions WHERE stripe_subscription_id = ?',
    [subscriptionId]
  );

  if (subs.length === 0) return;

  const dojoId = subs[0].dojo_id;

  // Status auf aktiv setzen (falls suspended)
  await db.promise().query(
    `UPDATE dojo_subscriptions
     SET status = 'active'
     WHERE dojo_id = ? AND status = 'suspended'`,
    [dojoId]
  );

  logger.info('Rechnung bezahlt:', { dojo_id: dojoId, invoice_id: invoice.id });
}

async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const [subs] = await db.promise().query(
    'SELECT dojo_id, subscription_id FROM dojo_subscriptions WHERE stripe_subscription_id = ?',
    [subscriptionId]
  );

  if (subs.length === 0) return;

  const { dojo_id, subscription_id } = subs[0];

  // Audit-Log
  await db.promise().query(
    `INSERT INTO subscription_audit_log
     (subscription_id, dojo_id, action, reason)
     VALUES (?, ?, 'payment_failed', ?)`,
    [subscription_id, dojo_id, `Zahlung fehlgeschlagen. Invoice: ${invoice.id}`]
  );

  logger.warn('Zahlung fehlgeschlagen:', { dojo_id, invoice_id: invoice.id });

  // Email an Dojo-Admin senden
  const [dojoData] = await db.promise().query(
    'SELECT dojoname, email, inhaber, subdomain FROM dojo WHERE id = ?',
    [dojo_id]
  );

  if (dojoData.length > 0) {
    const dojo = dojoData[0];
    sendSaasNotification('paymentFailed', {
      dojo_id: dojo_id,
      dojoname: dojo.dojoname,
      email: dojo.email,
      inhaber: dojo.inhaber,
      subdomain: dojo.subdomain
    }).catch(err => logger.warn('Payment-Failed Benachrichtigung fehlgeschlagen:', err.message));
  }
}

async function handleSubscriptionUpdated(subscription) {
  const [subs] = await db.promise().query(
    'SELECT dojo_id FROM dojo_subscriptions WHERE stripe_subscription_id = ?',
    [subscription.id]
  );

  if (subs.length === 0) return;

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'suspended' :
                 subscription.status === 'canceled' ? 'cancelled' : 'active';

  await db.promise().query(
    'UPDATE dojo_subscriptions SET status = ? WHERE stripe_subscription_id = ?',
    [status, subscription.id]
  );

  logger.info('Subscription aktualisiert:', {
    dojo_id: subs[0].dojo_id,
    stripe_status: subscription.status,
    local_status: status
  });
}

async function handleSubscriptionDeleted(subscription) {
  const [subs] = await db.promise().query(
    'SELECT dojo_id, subscription_id FROM dojo_subscriptions WHERE stripe_subscription_id = ?',
    [subscription.id]
  );

  if (subs.length === 0) return;

  const { dojo_id, subscription_id } = subs[0];

  // Downgrade zu Trial
  await db.promise().query(
    `UPDATE dojo_subscriptions SET
       status = 'cancelled',
       stripe_subscription_id = NULL,
       cancelled_at = NOW()
     WHERE dojo_id = ?`,
    [dojo_id]
  );

  // Audit-Log
  await db.promise().query(
    `INSERT INTO subscription_audit_log
     (subscription_id, dojo_id, action, reason)
     VALUES (?, ?, 'cancelled', ?)`,
    [subscription_id, dojo_id, `Stripe Subscription gekündigt: ${subscription.id}`]
  );

  logger.info('Subscription gekündigt:', { dojo_id, stripe_subscription: subscription.id });
}

// ============================================
// GET /subscription-status
// Aktuellen Subscription-Status abrufen
// ============================================
router.get('/subscription-status', authenticateToken, async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;

    const [sub] = await db.promise().query(
      `SELECT ds.*, d.dojoname, sp.display_name as plan_display_name
       FROM dojo_subscriptions ds
       JOIN dojo d ON ds.dojo_id = d.id
       LEFT JOIN subscription_plans sp ON ds.plan_type = sp.plan_name
       WHERE ds.dojo_id = ?`,
      [dojoId]
    );

    if (sub.length === 0) {
      return res.status(404).json({ error: 'Keine Subscription gefunden' });
    }

    // Verfügbare Upgrades
    const currentPlan = sub[0].plan_type;
    const [upgrades] = await db.promise().query(
      `SELECT * FROM subscription_plans
       WHERE is_visible = TRUE AND is_deprecated = FALSE
       ORDER BY sort_order ASC`
    );

    const availableUpgrades = upgrades.filter(
      p => PLAN_HIERARCHY[p.plan_name] > PLAN_HIERARCHY[currentPlan]
    );

    res.json({
      subscription: sub[0],
      available_upgrades: availableUpgrades,
      can_upgrade: availableUpgrades.length > 0
    });

  } catch (error) {
    logger.error('Fehler beim Laden des Subscription-Status:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
