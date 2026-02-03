/**
 * Stripe Payment Routes
 * Einmal- und wiederkehrende Zahlungen
 */
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const db = require("../db");
const logger = require("../utils/logger");
const { authenticateToken } = require("../middleware/auth");

// Helper: Get Stripe instance for dojo
const getStripeForDojo = async (dojoId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT stripe_secret_key, stripe_publishable_key FROM dojo WHERE id = ?",
      [dojoId],
      (err, results) => {
        if (err) return reject(err);
        if (!results[0]?.stripe_secret_key) {
          return reject(new Error("Stripe nicht konfiguriert für dieses Dojo"));
        }
        resolve({
          stripe: new Stripe(results[0].stripe_secret_key),
          publishableKey: results[0].stripe_publishable_key
        });
      }
    );
  });
};

// GET /stripe/config - Stripe Public Key für Frontend
router.get("/config", authenticateToken, async (req, res) => {
  try {
    const dojoId = req.user.dojo_id || req.query.dojo_id;
    if (!dojoId) {
      return res.status(400).json({ error: "Dojo ID erforderlich" });
    }

    const { publishableKey } = await getStripeForDojo(dojoId);
    res.json({ publishableKey });
  } catch (error) {
    logger.error("Stripe Config Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /stripe/create-checkout-session - Checkout für Einmalzahlungen
router.post("/create-checkout-session", authenticateToken, async (req, res) => {
  try {
    const { amount, description, metadata, successUrl, cancelUrl, dojoId: requestDojoId } = req.body;
    const dojoId = req.user.dojo_id || requestDojoId;

    if (!dojoId || !amount) {
      return res.status(400).json({ error: "Dojo ID und Betrag erforderlich" });
    }

    const { stripe } = await getStripeForDojo(dojoId);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: description || "Zahlung",
          },
          unit_amount: Math.round(amount * 100), // Cent
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: successUrl || `${req.headers.origin}/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/zahlung/abgebrochen`,
      metadata: {
        dojo_id: dojoId,
        ...metadata
      }
    });

    // In DB speichern
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO stripe_payment_intents (dojo_id, stripe_payment_intent_id, amount, currency, status, description, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dojoId, session.id, Math.round(amount * 100), "eur", "pending", description, JSON.stringify(metadata)],
        (err, result) => err ? reject(err) : resolve(result)
      );
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    logger.error("Stripe Checkout Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /stripe/create-payment-intent - Payment Intent für Custom Payment Flow
router.post("/create-payment-intent", authenticateToken, async (req, res) => {
  try {
    const { amount, description, metadata, dojoId: requestDojoId } = req.body;
    const dojoId = req.user.dojo_id || requestDojoId;

    if (!dojoId || !amount) {
      return res.status(400).json({ error: "Dojo ID und Betrag erforderlich" });
    }

    const { stripe, publishableKey } = await getStripeForDojo(dojoId);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "eur",
      payment_method_types: ["card", "sepa_debit"],
      metadata: {
        dojo_id: dojoId,
        ...metadata
      },
      description
    });

    // In DB speichern
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO stripe_payment_intents (dojo_id, stripe_payment_intent_id, amount, currency, status, description, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dojoId, paymentIntent.id, Math.round(amount * 100), "eur", paymentIntent.status, description, JSON.stringify(metadata)],
        (err, result) => err ? reject(err) : resolve(result)
      );
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    logger.error("Stripe Payment Intent Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// SUBSCRIPTION / WIEDERKEHRENDE ZAHLUNGEN
// =====================================================

// POST /stripe/sync-tarif - Tarif mit Stripe Product/Price synchronisieren
router.post("/sync-tarif", authenticateToken, async (req, res) => {
  try {
    const { tarifId, dojoId: requestDojoId } = req.body;
    const dojoId = req.user.dojo_id || requestDojoId;

    if (!dojoId || !tarifId) {
      return res.status(400).json({ error: "Dojo ID und Tarif ID erforderlich" });
    }

    const { stripe } = await getStripeForDojo(dojoId);

    // Tarif aus DB laden
    const [tarife] = await db.promise().query(
      "SELECT * FROM tarife WHERE id = ? AND dojo_id = ?",
      [tarifId, dojoId]
    );

    if (tarife.length === 0) {
      return res.status(404).json({ error: "Tarif nicht gefunden" });
    }

    const tarif = tarife[0];

    // Billing Interval bestimmen
    const intervalMap = {
      'MONTHLY': { interval: 'month', interval_count: 1 },
      'QUARTERLY': { interval: 'month', interval_count: 3 },
      'YEARLY': { interval: 'year', interval_count: 1 }
    };
    const billing = intervalMap[tarif.billing_cycle] || intervalMap['MONTHLY'];

    let product, price;

    // Produkt erstellen oder aktualisieren
    if (tarif.stripe_product_id) {
      product = await stripe.products.update(tarif.stripe_product_id, {
        name: tarif.name,
        active: tarif.active === 1
      });
    } else {
      product = await stripe.products.create({
        name: tarif.name,
        metadata: { dojo_id: String(dojoId), tarif_id: String(tarifId) }
      });
    }

    // Preis erstellen (Preise können nicht aktualisiert werden, nur archiviert)
    if (tarif.stripe_price_id) {
      // Alten Preis archivieren wenn Betrag sich geändert hat
      const oldPrice = await stripe.prices.retrieve(tarif.stripe_price_id);
      if (oldPrice.unit_amount !== tarif.price_cents) {
        await stripe.prices.update(tarif.stripe_price_id, { active: false });
        tarif.stripe_price_id = null;
      }
    }

    if (!tarif.stripe_price_id) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: tarif.price_cents,
        currency: tarif.currency.toLowerCase(),
        recurring: {
          interval: billing.interval,
          interval_count: billing.interval_count
        },
        metadata: { dojo_id: String(dojoId), tarif_id: String(tarifId) }
      });
    } else {
      price = await stripe.prices.retrieve(tarif.stripe_price_id);
    }

    // In DB speichern
    await db.promise().query(
      "UPDATE tarife SET stripe_product_id = ?, stripe_price_id = ? WHERE id = ?",
      [product.id, price.id, tarifId]
    );

    logger.info(`Tarif ${tarifId} mit Stripe synchronisiert: Product ${product.id}, Price ${price.id}`);

    res.json({
      success: true,
      productId: product.id,
      priceId: price.id
    });
  } catch (error) {
    logger.error("Stripe Tarif-Sync Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /stripe/create-customer - Stripe Customer für Mitglied erstellen
router.post("/create-customer", authenticateToken, async (req, res) => {
  try {
    const { mitgliedId, dojoId: requestDojoId } = req.body;
    const dojoId = req.user.dojo_id || requestDojoId;

    if (!dojoId || !mitgliedId) {
      return res.status(400).json({ error: "Dojo ID und Mitglied ID erforderlich" });
    }

    const { stripe } = await getStripeForDojo(dojoId);

    // Mitglied aus DB laden
    const [mitglieder] = await db.promise().query(
      "SELECT * FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?",
      [mitgliedId, dojoId]
    );

    if (mitglieder.length === 0) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    const mitglied = mitglieder[0];

    // Prüfen ob Customer bereits existiert
    if (mitglied.stripe_customer_id) {
      const customer = await stripe.customers.retrieve(mitglied.stripe_customer_id);
      return res.json({ customerId: customer.id, existing: true });
    }

    // Neuen Customer erstellen
    const customer = await stripe.customers.create({
      email: mitglied.email,
      name: `${mitglied.vorname} ${mitglied.nachname}`,
      address: {
        line1: mitglied.strasse || '',
        postal_code: mitglied.plz || '',
        city: mitglied.ort || '',
        country: 'DE'
      },
      metadata: {
        dojo_id: String(dojoId),
        mitglied_id: String(mitgliedId)
      }
    });

    // In DB speichern
    await db.promise().query(
      "UPDATE mitglieder SET stripe_customer_id = ? WHERE mitglied_id = ?",
      [customer.id, mitgliedId]
    );

    logger.info(`Stripe Customer für Mitglied ${mitgliedId} erstellt: ${customer.id}`);

    res.json({ customerId: customer.id, existing: false });
  } catch (error) {
    logger.error("Stripe Customer Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /stripe/create-subscription - Subscription für Mitglied erstellen
router.post("/create-subscription", authenticateToken, async (req, res) => {
  try {
    const { mitgliedId, tarifId, dojoId: requestDojoId } = req.body;
    const dojoId = req.user.dojo_id || requestDojoId;

    if (!dojoId || !mitgliedId || !tarifId) {
      return res.status(400).json({ error: "Dojo ID, Mitglied ID und Tarif ID erforderlich" });
    }

    const { stripe, publishableKey } = await getStripeForDojo(dojoId);

    // Mitglied laden
    const [mitglieder] = await db.promise().query(
      "SELECT * FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?",
      [mitgliedId, dojoId]
    );

    if (mitglieder.length === 0) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    const mitglied = mitglieder[0];

    // Tarif laden
    const [tarife] = await db.promise().query(
      "SELECT * FROM tarife WHERE id = ? AND dojo_id = ?",
      [tarifId, dojoId]
    );

    if (tarife.length === 0) {
      return res.status(404).json({ error: "Tarif nicht gefunden" });
    }

    const tarif = tarife[0];

    if (!tarif.stripe_price_id) {
      return res.status(400).json({ error: "Tarif ist nicht mit Stripe synchronisiert" });
    }

    // Customer erstellen falls nicht vorhanden
    let customerId = mitglied.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: mitglied.email,
        name: `${mitglied.vorname} ${mitglied.nachname}`,
        metadata: { dojo_id: String(dojoId), mitglied_id: String(mitgliedId) }
      });
      customerId = customer.id;
      await db.promise().query(
        "UPDATE mitglieder SET stripe_customer_id = ? WHERE mitglied_id = ?",
        [customerId, mitgliedId]
      );
    }

    // Subscription erstellen
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: tarif.stripe_price_id }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        dojo_id: String(dojoId),
        mitglied_id: String(mitgliedId),
        tarif_id: String(tarifId)
      }
    });

    // In DB speichern
    await db.promise().query(
      "UPDATE mitglieder SET stripe_subscription_id = ?, stripe_subscription_status = ? WHERE mitglied_id = ?",
      [subscription.id, subscription.status, mitgliedId]
    );

    logger.info(`Subscription für Mitglied ${mitgliedId} erstellt: ${subscription.id}`);

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      publishableKey,
      status: subscription.status
    });
  } catch (error) {
    logger.error("Stripe Subscription Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /stripe/cancel-subscription - Subscription kündigen
router.post("/cancel-subscription", authenticateToken, async (req, res) => {
  try {
    const { mitgliedId, dojoId: requestDojoId, immediately } = req.body;
    const dojoId = req.user.dojo_id || requestDojoId;

    if (!dojoId || !mitgliedId) {
      return res.status(400).json({ error: "Dojo ID und Mitglied ID erforderlich" });
    }

    const { stripe } = await getStripeForDojo(dojoId);

    // Mitglied laden
    const [mitglieder] = await db.promise().query(
      "SELECT stripe_subscription_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?",
      [mitgliedId, dojoId]
    );

    if (mitglieder.length === 0 || !mitglieder[0].stripe_subscription_id) {
      return res.status(404).json({ error: "Keine aktive Subscription gefunden" });
    }

    const subscriptionId = mitglieder[0].stripe_subscription_id;

    let subscription;
    if (immediately) {
      // Sofort kündigen
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    } else {
      // Zum Periodenende kündigen
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }

    // Status in DB aktualisieren
    await db.promise().query(
      "UPDATE mitglieder SET stripe_subscription_status = ? WHERE mitglied_id = ?",
      [subscription.status, mitgliedId]
    );

    logger.info(`Subscription ${subscriptionId} für Mitglied ${mitgliedId} gekündigt`);

    res.json({
      success: true,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end
    });
  } catch (error) {
    logger.error("Stripe Cancel Subscription Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stripe/subscription/:mitgliedId - Subscription-Status abrufen
router.get("/subscription/:mitgliedId", authenticateToken, async (req, res) => {
  try {
    const { mitgliedId } = req.params;
    const dojoId = req.user.dojo_id || req.query.dojo_id;

    if (!dojoId) {
      return res.status(400).json({ error: "Dojo ID erforderlich" });
    }

    const { stripe } = await getStripeForDojo(dojoId);

    // Mitglied laden
    const [mitglieder] = await db.promise().query(
      "SELECT stripe_subscription_id, stripe_subscription_status FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?",
      [mitgliedId, dojoId]
    );

    if (mitglieder.length === 0) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    const mitglied = mitglieder[0];

    if (!mitglied.stripe_subscription_id) {
      return res.json({ hasSubscription: false });
    }

    // Aktuelle Daten von Stripe holen
    const subscription = await stripe.subscriptions.retrieve(mitglied.stripe_subscription_id);

    res.json({
      hasSubscription: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      priceId: subscription.items.data[0]?.price?.id
    });
  } catch (error) {
    logger.error("Stripe Subscription Status Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stripe/payment/:id - Zahlungsstatus abrufen
router.get("/payment/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = req.user.dojo_id || req.query.dojo_id;

    if (!dojoId) {
      return res.status(400).json({ error: "Dojo ID erforderlich" });
    }

    const { stripe } = await getStripeForDojo(dojoId);

    // Prüfen ob es eine Session oder Payment Intent ID ist
    let payment;
    if (id.startsWith("cs_")) {
      payment = await stripe.checkout.sessions.retrieve(id);
    } else if (id.startsWith("pi_")) {
      payment = await stripe.paymentIntents.retrieve(id);
    } else {
      return res.status(400).json({ error: "Ungültige Zahlungs-ID" });
    }

    res.json({
      id: payment.id,
      status: payment.status,
      amount: payment.amount_total || payment.amount,
      currency: payment.currency
    });
  } catch (error) {
    logger.error("Stripe Payment Status Fehler:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /stripe/webhook - Stripe Webhook (OHNE Auth!)
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  // Für jeden Dojo den Webhook prüfen (Multi-Tenant)
  // TODO: Webhook Secret pro Dojo speichern
  try {
    const event = JSON.parse(req.body);
    logger.info("Stripe Webhook empfangen:", event.type);

    // Event in DB speichern
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO stripe_webhooks (stripe_event_id, event_type, webhook_data) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE webhook_data = VALUES(webhook_data)`,
        [event.id, event.type, JSON.stringify(event)],
        (err, result) => err ? reject(err) : resolve(result)
      );
    });

    // Event verarbeiten
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object);
        break;
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Stripe Webhook Fehler:", error);
    res.status(400).json({ error: error.message });
  }
});

// Webhook Handlers
async function handleCheckoutComplete(session) {
  logger.info("Checkout abgeschlossen:", session.id);
  await updatePaymentStatus(session.id, "completed");

  // Event-Zahlung oder Shop-Bestellung aktualisieren
  if (session.metadata?.event_anmeldung_id) {
    await db.promise().query(
      "UPDATE event_anmeldungen SET bezahlt = 1, bezahlt_am = NOW(), stripe_session_id = ? WHERE id = ?",
      [session.id, session.metadata.event_anmeldung_id]
    );
  }
  if (session.metadata?.bestellung_id) {
    await db.promise().query(
      "UPDATE shop_bestellungen SET status = bezahlt, stripe_session_id = ? WHERE id = ?",
      [session.id, session.metadata.bestellung_id]
    );
  }
}

async function handlePaymentSucceeded(paymentIntent) {
  logger.info("Zahlung erfolgreich:", paymentIntent.id);
  await updatePaymentStatus(paymentIntent.id, "succeeded");
}

async function handlePaymentFailed(paymentIntent) {
  logger.error("Zahlung fehlgeschlagen:", paymentIntent.id);
  await updatePaymentStatus(paymentIntent.id, "failed");
}

async function handleInvoicePaid(invoice) {
  logger.info("Rechnung bezahlt:", invoice.id);
  // Mitgliedschaft verlängern bei Subscription
  if (invoice.subscription) {
    // TODO: Mitgliedschaft Status aktualisieren
  }
}

async function handleInvoiceFailed(invoice) {
  logger.error("Rechnungszahlung fehlgeschlagen:", invoice.id);
  // TODO: Admin benachrichtigen
}

async function updatePaymentStatus(stripeId, status) {
  await new Promise((resolve, reject) => {
    db.query(
      "UPDATE stripe_payment_intents SET status = ?, updated_at = NOW() WHERE stripe_payment_intent_id = ?",
      [status, stripeId],
      (err, result) => err ? reject(err) : resolve(result)
    );
  });
}

async function handleSubscriptionUpdate(subscription) {
  const mitgliedId = subscription.metadata?.mitglied_id;
  if (!mitgliedId) {
    logger.warn("Subscription ohne mitglied_id in metadata:", subscription.id);
    return;
  }

  logger.info(`Subscription ${subscription.id} Status: ${subscription.status}`);

  await db.promise().query(
    "UPDATE mitglieder SET stripe_subscription_status = ? WHERE mitglied_id = ?",
    [subscription.status, mitgliedId]
  );

  // Bei aktivem Status: Mitglied auf aktiv setzen
  if (subscription.status === 'active') {
    await db.promise().query(
      "UPDATE mitglieder SET aktiv = 1 WHERE mitglied_id = ?",
      [mitgliedId]
    );
    logger.info(`Mitglied ${mitgliedId} auf aktiv gesetzt`);
  }
}

async function handleSubscriptionDeleted(subscription) {
  const mitgliedId = subscription.metadata?.mitglied_id;
  if (!mitgliedId) {
    logger.warn("Gelöschte Subscription ohne mitglied_id:", subscription.id);
    return;
  }

  logger.info(`Subscription ${subscription.id} gelöscht für Mitglied ${mitgliedId}`);

  await db.promise().query(
    `UPDATE mitglieder SET
     stripe_subscription_status = 'canceled',
     status = 'gekuendigt'
     WHERE mitglied_id = ?`,
    [mitgliedId]
  );
}

module.exports = router;
