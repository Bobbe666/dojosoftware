const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * Subscription Management Routes
 * Verwaltet Subscriptions, Upgrades, Downgrades
 */

// ============================================
// PUBLIC ROUTES (kein Auth nötig - für LandingPage)
// ============================================

// GET alle Features
router.get('/features', async (req, res) => {
  try {
    // SET NAMES für korrekte UTF-8 Encoding (Emojis)
    await db.promise().query('SET NAMES utf8mb4');
    const [features] = await db.promise().query(
      `SELECT feature_id, feature_key, feature_name, feature_icon,
              feature_description, feature_category, sort_order
       FROM plan_features
       WHERE is_active = 1
       ORDER BY sort_order ASC`
    );

    res.charset = 'utf-8';
    res.json({ features });
  } catch (error) {
    logger.error('Fehler beim Laden der Features:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Pläne mit allen Features
router.get('/plans-with-features', async (req, res) => {
  try {
    // Alle aktiven Pläne laden
    const [plans] = await db.promise().query(
      `SELECT plan_id, plan_name, display_name, description,
              price_monthly, price_yearly, max_members, max_dojos,
              storage_limit_mb, sort_order
       FROM subscription_plans
       WHERE is_visible = 1 AND is_deprecated = 0
       ORDER BY sort_order ASC`
    );

    // Alle Features laden
    const [allFeatures] = await db.promise().query(
      `SELECT feature_id, feature_key, feature_name, feature_icon,
              feature_description, feature_category, sort_order
       FROM plan_features
       WHERE is_active = 1
       ORDER BY sort_order ASC`
    );

    // Plan-Feature-Mappings laden
    const [mappings] = await db.promise().query(
      `SELECT plan_id, feature_id, is_included
       FROM plan_feature_mapping`
    );

    // Mapping pro Plan erstellen
    const planFeatureMap = {};
    mappings.forEach(m => {
      if (!planFeatureMap[m.plan_id]) {
        planFeatureMap[m.plan_id] = new Set();
      }
      if (m.is_included) {
        planFeatureMap[m.plan_id].add(m.feature_id);
      }
    });

    // Pläne mit Features zusammenführen
    const plansWithFeatures = plans.map(plan => {
      const includedFeatureIds = planFeatureMap[plan.plan_id] || new Set();
      const features = allFeatures.map(f => ({
        ...f,
        included: includedFeatureIds.has(f.feature_id)
      }));

      return {
        ...plan,
        features,
        feature_count: includedFeatureIds.size
      };
    });

    res.json({
      plans: plansWithFeatures,
      all_features: allFeatures
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Plans mit Features:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Features für LandingPage (vereinfachte Liste)
router.get('/landing-features', async (req, res) => {
  try {
    // SET NAMES für korrekte UTF-8 Encoding (Emojis)
    await db.promise().query('SET NAMES utf8mb4');
    const [features] = await db.promise().query(
      `SELECT feature_key, feature_name, feature_icon, feature_description
       FROM plan_features
       WHERE is_active = 1 AND feature_category IN ('core', 'member', 'financial', 'admin')
       ORDER BY sort_order ASC
       LIMIT 16`
    );

    res.charset = 'utf-8';
    res.json({ features });
  } catch (error) {
    logger.error('Fehler beim Laden der Landing Features:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Preise für LandingPage Pricing Preview (alle Pläne mit Features)
router.get('/pricing-preview', async (req, res) => {
  try {
    const [plans] = await db.promise().query(
      `SELECT plan_name, display_name, price_monthly, price_yearly,
              max_members, max_dojos, storage_limit_mb, sort_order,
              feature_verkauf, feature_buchfuehrung, feature_events,
              feature_multidojo, feature_api
       FROM subscription_plans
       WHERE is_visible = 1 AND is_deprecated = 0
       ORDER BY sort_order ASC`
    );

    // Feature-Matrix für Vergleichstabelle erstellen
    const featureMatrix = [
      { key: 'mitgliederverwaltung', label: 'Mitgliederverwaltung' },
      { key: 'checkin', label: 'Check-In System' },
      { key: 'online_registration', label: 'Online-Registrierung' },
      { key: 'member_portal', label: 'Mitglieder-Portal' },
      { key: 'sepa', label: 'SEPA-Lastschriften' },
      { key: 'pruefungen', label: 'Prüfungswesen' },
      { key: 'verkauf', label: 'Verkauf & Kasse' },
      { key: 'events', label: 'Events & Turniere' },
      { key: 'buchfuehrung', label: 'Buchführung & EÜR' },
      { key: 'api', label: 'API-Zugang' },
      { key: 'multidojo', label: 'Multi-Dojo' },
      { key: 'priority_support', label: 'Prioritäts-Support' }
    ];

    // Feature-Zuordnung basierend auf Plan-Hierarchie
    const planFeatures = plans.map(plan => {
      const isBasic = plan.plan_name === 'basic';
      const isStarter = plan.plan_name === 'starter';
      const isProfessional = plan.plan_name === 'professional';
      const isPremium = plan.plan_name === 'premium';
      const isEnterprise = plan.plan_name === 'enterprise';

      return {
        ...plan,
        features: {
          mitgliederverwaltung: true, // Alle Pläne
          checkin: true, // Alle Pläne
          online_registration: true, // Alle Pläne
          member_portal: !isBasic, // Ab Starter
          sepa: !isBasic, // Ab Starter
          pruefungen: !isBasic, // Ab Starter
          verkauf: plan.feature_verkauf || false,
          events: plan.feature_events || false,
          buchfuehrung: plan.feature_buchfuehrung || false,
          api: plan.feature_api || false,
          multidojo: plan.feature_multidojo || false,
          priority_support: isPremium || isEnterprise
        }
      };
    });

    res.json({ plans: planFeatures, featureMatrix });
  } catch (error) {
    logger.error('Fehler beim Laden der Pricing Preview:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Konkurrenz-Vergleich für LandingPage (öffentlich)
router.get('/comparison', async (req, res) => {
  try {
    await db.promise().query('SET NAMES utf8mb4');

    // Konkurrenten laden
    const [competitors] = await db.promise().query(
      'SELECT id, name, short_name FROM comparison_competitors WHERE is_active = 1 ORDER BY sort_order'
    );

    // Kategorien mit Features und Bewertungen laden
    const [categories] = await db.promise().query(`
      SELECT id, name, icon, is_highlight, highlight_note, sort_order
      FROM comparison_categories
      WHERE is_active = 1
      ORDER BY sort_order
    `);

    // Für jede Kategorie: Features mit Bewertungen
    const categoriesWithItems = await Promise.all(categories.map(async (cat) => {
      const [items] = await db.promise().query(`
        SELECT ci.id, ci.feature_name
        FROM comparison_items ci
        WHERE ci.category_id = ? AND ci.is_active = 1
        ORDER BY ci.sort_order
      `, [cat.id]);

      // Bewertungen für alle Items dieser Kategorie
      const itemIds = items.map(i => i.id);
      if (itemIds.length === 0) {
        return { ...cat, items: [] };
      }

      const [ratings] = await db.promise().query(`
        SELECT item_id, competitor_id, rating, is_ours
        FROM comparison_ratings
        WHERE item_id IN (?)
      `, [itemIds]);

      const itemsWithRatings = items.map(item => {
        const itemRatings = ratings.filter(r => r.item_id === item.id);
        const oursRating = itemRatings.find(r => r.is_ours === 1);
        const competitorRatings = {};
        itemRatings.filter(r => !r.is_ours).forEach(r => {
          competitorRatings[r.competitor_id] = r.rating;
        });

        return {
          name: item.feature_name,
          ours: oursRating?.rating || 'none',
          competitors: competitorRatings
        };
      });

      return {
        ...cat,
        items: itemsWithRatings
      };
    }));

    res.json({
      success: true,
      competitors,
      categories: categoriesWithItems
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Vergleichsdaten:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Vergleichsdaten' });
  }
});

// ============================================
// AUTHENTICATED ROUTES (ab hier Auth nötig)
// ============================================

// Alle weiteren Routes benötigen Authentication
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
    logger.error('Fehler beim Laden der Subscription:', { error: error });
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
    logger.error('Fehler beim Laden der Pl\u00e4ne:', { error: error });
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
    logger.error('Fehler beim Plan-Wechsel:', { error: error });
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
    logger.error('Fehler bei K\u00fcndigung:', { error: error });
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
    logger.error('Fehler bei Reaktivierung:', { error: error });
    res.status(500).json({ error: 'Serverfehler bei Reaktivierung' });
  }
});

// ============================================
// 6. SELF-SERVICE UPGRADE (Stripe Checkout)
// ============================================
router.post('/create-upgrade-checkout', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;
    const { new_plan, billing_interval = 'monthly' } = req.body;

    if (!new_plan) {
      return res.status(400).json({ error: 'Neuer Plan fehlt' });
    }

    // Plan-Hierarchie für Upgrade-Prüfung (nur Upgrades erlaubt!)
    const PLAN_HIERARCHY = {
      'trial': 0,
      'starter': 1,
      'professional': 2,
      'premium': 3,
      'enterprise': 4
    };

    if (!(new_plan in PLAN_HIERARCHY)) {
      return res.status(400).json({
        error: 'Ungültiger Plan',
        valid_plans: Object.keys(PLAN_HIERARCHY).filter(p => p !== 'trial')
      });
    }

    // Aktuellen Plan laden
    const [currentSub] = await db.promise().query(
      `SELECT s.*, d.dojoname, d.email, d.stripe_secret_key, d.inhaber
       FROM dojo_subscriptions s
       JOIN dojo d ON s.dojo_id = d.id
       WHERE s.dojo_id = ?`,
      [dojoId]
    );

    if (currentSub.length === 0) {
      return res.status(404).json({ error: 'Keine Subscription gefunden' });
    }

    const current = currentSub[0];
    const currentPlan = current.plan_type || 'trial';

    // NUR UPGRADES erlaubt!
    if (PLAN_HIERARCHY[new_plan] <= PLAN_HIERARCHY[currentPlan]) {
      return res.status(400).json({
        error: 'Nur Upgrades erlaubt. Für Downgrades kontaktieren Sie den Support.',
        current_plan: currentPlan,
        requested_plan: new_plan
      });
    }

    // Plan-Details laden
    const [planDetails] = await db.promise().query(
      `SELECT * FROM subscription_plans WHERE plan_name = ?`,
      [new_plan]
    );

    if (planDetails.length === 0) {
      return res.status(400).json({ error: 'Plan nicht in subscription_plans gefunden' });
    }

    const plan = planDetails[0];
    const price = billing_interval === 'yearly' ? plan.price_yearly : plan.price_monthly;

    // TDA Stripe Key verwenden (nicht der Dojo's eigene)
    // Das ist für die DojoSoftware Subscription, nicht für Mitgliederbeiträge
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(500).json({ error: 'Stripe nicht konfiguriert' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecretKey);

    // Preis ID aus subscription_plans oder dynamisch erstellen
    let priceId = billing_interval === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;

    // Falls keine Stripe Price ID vorhanden, dynamisch erstellen
    if (!priceId) {
      // Erst Product suchen oder erstellen
      let productId = plan.stripe_product_id;
      if (!productId) {
        const product = await stripe.products.create({
          name: `DojoSoftware ${plan.display_name}`,
          description: plan.description || `DojoSoftware Plan: ${plan.display_name}`,
          metadata: { plan_name: new_plan }
        });
        productId = product.id;
        // Update in DB
        await db.promise().query(
          'UPDATE subscription_plans SET stripe_product_id = ? WHERE plan_name = ?',
          [productId, new_plan]
        );
      }

      // Price erstellen
      const stripePrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(price * 100),
        currency: 'eur',
        recurring: {
          interval: billing_interval === 'yearly' ? 'year' : 'month'
        },
        metadata: { plan_name: new_plan, billing_interval }
      });
      priceId = stripePrice.id;

      // Update in DB
      const priceField = billing_interval === 'yearly' ? 'stripe_price_id_yearly' : 'stripe_price_id_monthly';
      await db.promise().query(
        `UPDATE subscription_plans SET ${priceField} = ? WHERE plan_name = ?`,
        [priceId, new_plan]
      );
    }

    // Checkout Session erstellen
    const baseUrl = process.env.FRONTEND_URL || 'https://dojo.tda-intl.org';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      customer_email: current.email,
      success_url: `${baseUrl}/einstellungen?upgrade=success&plan=${new_plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/einstellungen?upgrade=cancelled`,
      metadata: {
        dojo_id: String(dojoId),
        old_plan: currentPlan,
        new_plan: new_plan,
        billing_interval: billing_interval,
        dojoname: current.dojoname
      },
      subscription_data: {
        metadata: {
          dojo_id: String(dojoId),
          plan_name: new_plan
        }
      }
    });

    logger.info('Stripe Upgrade Checkout erstellt:', {
      dojo_id: dojoId,
      dojoname: current.dojoname,
      old_plan: currentPlan,
      new_plan: new_plan,
      session_id: session.id
    });

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      new_plan: new_plan,
      price: price,
      billing_interval: billing_interval
    });

  } catch (error) {
    logger.error('Fehler beim Erstellen des Upgrade-Checkouts:', { error: error });
    res.status(500).json({ error: error.message || 'Serverfehler beim Checkout' });
  }
});

// ============================================
// 7. GET SUBSCRIPTION HISTORY (Audit-Log)
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
    logger.error('Fehler beim Laden der History:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ============================================
// 8. FEATURE TRIALS & ACCESS
// ============================================

// Import Feature Access Service
const featureAccessService = require('../services/featureAccessService');

// GET alle Features mit Zugriffsstatus für aktuelles Dojo
router.get('/features-with-access', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;
    const features = await featureAccessService.getAllFeaturesWithAccess(dojoId);
    res.json({ features });
  } catch (error) {
    logger.error('Fehler beim Laden der Features:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Zugriffsprüfung für einzelnes Feature
router.get('/feature-access/:featureKey', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;
    const { featureKey } = req.params;
    const access = await featureAccessService.hasFeatureAccess(dojoId, featureKey);
    res.json(access);
  } catch (error) {
    logger.error('Fehler bei Feature-Zugriffsprüfung:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST Feature-Trial starten
router.post('/feature-trial/start', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;
    const { featureId } = req.body;

    if (!featureId) {
      return res.status(400).json({ error: 'Feature ID erforderlich' });
    }

    const result = await featureAccessService.startFeatureTrial(dojoId, featureId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      trial: result.trial,
      message: result.message
    });

  } catch (error) {
    logger.error('Fehler beim Starten des Trials:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET aktive Feature-Trials für aktuelles Dojo
router.get('/feature-trials', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;

    const [trials] = await db.promise().query(
      `SELECT ft.*, pf.feature_name, pf.feature_key, pf.feature_icon,
              TIMESTAMPDIFF(DAY, NOW(), ft.expires_at) as days_remaining
       FROM feature_trials ft
       JOIN plan_features pf ON pf.feature_id = ft.feature_id
       WHERE ft.dojo_id = ? AND ft.status = 'active'
       ORDER BY ft.expires_at ASC`,
      [dojoId]
    );

    res.json({ trials });

  } catch (error) {
    logger.error('Fehler beim Laden der Trials:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET aktive Feature-Addons für aktuelles Dojo
router.get('/feature-addons', async (req, res) => {
  try {
    const dojoId = req.user.dojo_id;

    const [addons] = await db.promise().query(
      `SELECT fa.*, pf.feature_name, pf.feature_key, pf.feature_icon
       FROM feature_addons fa
       JOIN plan_features pf ON pf.feature_id = fa.feature_id
       WHERE fa.dojo_id = ? AND fa.status = 'active'
       ORDER BY fa.started_at DESC`,
      [dojoId]
    );

    res.json({ addons });

  } catch (error) {
    logger.error('Fehler beim Laden der Addons:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET Addon-Preise für ein Feature
router.get('/feature-addon-price/:featureId', async (req, res) => {
  try {
    const { featureId } = req.params;

    const [prices] = await db.promise().query(
      `SELECT fap.*, pf.feature_name, pf.feature_key
       FROM feature_addon_prices fap
       JOIN plan_features pf ON pf.feature_id = fap.feature_id
       WHERE fap.feature_id = ?`,
      [featureId]
    );

    if (prices.length === 0) {
      return res.status(404).json({ error: 'Addon-Preis nicht gefunden' });
    }

    res.json(prices[0]);

  } catch (error) {
    logger.error('Fehler beim Laden des Addon-Preises:', { error: error });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
