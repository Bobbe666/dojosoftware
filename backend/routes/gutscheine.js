/**
 * Gutschein-System – Backend Routes
 * POST/GET/PUT/DELETE /api/gutscheine/...
 * Öffentlich: /public/:code, /shop/:dojoId/..., /pdf/:token
 */
const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');
const db       = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireFeature }    = require('../middleware/featureAccess');
const { getSecureDojoId }   = require('../middleware/tenantSecurity');
const { generateGutscheinPdf } = require('../utils/gutscheinPdfGenerator');
const PayPalProvider = require('../services/PayPalProvider');

const pool = db.promise();
const PDF_DIR = path.join(__dirname, '..', 'uploads', 'gutscheine-pdf');
fs.mkdirSync(PDF_DIR, { recursive: true });

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GS-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const [[row]] = await pool.query('SELECT id FROM gutscheine WHERE code = ?', [code]);
    if (!row) return code;
  }
  throw new Error('Konnte keinen eindeutigen Code generieren');
}

// ─── Öffentliche Route — Gutschein-Info für Widget ───────────────────────────

// GET /api/public/gutschein/:code
router.get('/public/:code', async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT g.code, g.wert, g.titel, g.nachricht, g.gueltig_bis,
             g.eingeloest, g.empfaenger_name,
             v.bild_url, v.anlass, v.titel AS vorlage_titel,
             d.dojoname, d.farbe
      FROM gutscheine g
      JOIN gutschein_vorlagen v ON g.vorlage_id = v.id
      JOIN dojo d ON g.dojo_id = d.id
      WHERE g.code = ?
    `, [req.params.code]);
    if (!row) return res.status(404).json({ success: false, error: 'Gutschein nicht gefunden' });
    res.json({ success: true, gutschein: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PDF-Download per Token (kein Auth, Token IS die Auth) ────────────────────

router.get('/pdf/:token', async (req, res) => {
  try {
    const [[g]] = await pool.query(
      'SELECT * FROM gutscheine WHERE pdf_token = ? AND bezahlt = 1',
      [req.params.token]
    );
    if (!g) return res.status(404).json({ error: 'PDF nicht gefunden oder nicht bezahlt' });

    const filePath = path.join(__dirname, '..', 'uploads', g.pdf_pfad);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF-Datei nicht vorhanden' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="gutschein-${g.code}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Öffentlicher Gutschein-Shop ──────────────────────────────────────────────

// GET /api/gutscheine/shop/:dojoId/info — Dojo + Vorlagen + Zahlungsarten
router.get('/shop/:dojoId/info', async (req, res) => {
  try {
    const dojoId = parseInt(req.params.dojoId, 10);
    if (!dojoId) return res.status(400).json({ error: 'Ungültige Dojo-ID' });

    // Dojo-Info
    const [[dojo]] = await pool.query(
      'SELECT id, dojoname, farbe, subdomain FROM dojo WHERE id = ?',
      [dojoId]
    );
    if (!dojo) return res.status(404).json({ error: 'Dojo nicht gefunden' });

    // Feature aktiv?
    const [[sub]] = await pool.query(
      'SELECT feature_gutscheine, status FROM dojo_subscriptions WHERE dojo_id = ?',
      [dojoId]
    );
    if (!sub?.feature_gutscheine) {
      return res.status(403).json({ error: 'Gutscheine für dieses Dojo nicht aktiv' });
    }

    // Vorlagen
    const [vorlagen] = await pool.query(
      'SELECT id, anlass, titel, bild_url, sort_order FROM gutschein_vorlagen WHERE aktiv = 1 ORDER BY anlass, sort_order',
    );

    // Zahlungsarten prüfen
    const [[integrations]] = await pool.query(
      'SELECT paypal_client_id, paypal_sandbox FROM dojo_integrations WHERE dojo_id = ?',
      [dojoId]
    ).catch(() => [[null]]);
    const [[shopSettings]] = await pool.query(
      'SELECT stripe_publishable_key FROM shop_einstellungen WHERE dojo_id = ?',
      [dojoId]
    ).catch(() => [[null]]);

    const zahlungsarten = [];
    if (integrations?.paypal_client_id) {
      zahlungsarten.push({
        id:        'paypal',
        label:     'PayPal',
        client_id: integrations.paypal_client_id,
        sandbox:   integrations.paypal_sandbox === 1,
      });
    }
    if (shopSettings?.stripe_publishable_key) {
      zahlungsarten.push({
        id:              'stripe',
        label:           'Kreditkarte (Stripe)',
        publishable_key: shopSettings.stripe_publishable_key,
      });
    }

    res.json({
      success: true,
      dojo: { id: dojo.id, name: dojo.dojoname, farbe: dojo.farbe },
      vorlagen,
      zahlungsarten,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Hilfsfunktion: Gutschein erstellen + PDF generieren ─────────────────────

async function createAndPayGutschein(dojoId, body, zahlungsart, paymentId, paidAmount) {
  const {
    vorlage_id, wert, titel, nachricht, gueltig_bis,
    empfaenger_name, empfaenger_email, kaeufer_name, kaeufer_email
  } = body;

  if (!vorlage_id || !wert || !titel) throw new Error('vorlage_id, wert, titel fehlen');
  const numWert = parseFloat(wert);
  if (isNaN(numWert) || numWert <= 0) throw new Error('Ungültiger Wert');

  // Vorlage laden
  const [[vorlage]] = await pool.query(
    'SELECT id FROM gutschein_vorlagen WHERE id = ? AND aktiv = 1',
    [vorlage_id]
  );
  if (!vorlage) throw new Error('Vorlage nicht gefunden');

  // Eindeutigen Code generieren
  let code;
  for (let i = 0; i < 10; i++) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = 'GS-';
    for (let j = 0; j < 6; j++) c += chars[Math.floor(Math.random() * chars.length)];
    const [[exists]] = await pool.query('SELECT id FROM gutscheine WHERE code = ?', [c]);
    if (!exists) { code = c; break; }
  }
  if (!code) throw new Error('Code-Generierung fehlgeschlagen');

  const pdfToken = crypto.randomBytes(32).toString('hex');

  // Gutschein in DB schreiben
  const [result] = await pool.query(`
    INSERT INTO gutscheine
      (dojo_id, vorlage_id, code, wert, titel, nachricht, gueltig_bis,
       empfaenger_name, empfaenger_email,
       kaeufer_name, kaeufer_email,
       bezahlt, bezahlt_am, zahlungsart, payment_id, preis_bezahlt, pdf_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?, ?, ?)
  `, [
    dojoId, vorlage_id, code, numWert,
    titel.trim(), nachricht || null, gueltig_bis || null,
    empfaenger_name || null, empfaenger_email || null,
    kaeufer_name || null, kaeufer_email || null,
    zahlungsart, paymentId || null, paidAmount || numWert, pdfToken
  ]);

  const gutscheinId = result.insertId;

  // Vollständige Daten für PDF laden
  const [[fullGutschein]] = await pool.query(`
    SELECT g.*, v.bild_pfad, v.anlass, d.dojoname
    FROM gutscheine g
    JOIN gutschein_vorlagen v ON g.vorlage_id = v.id
    JOIN dojo d ON g.dojo_id = d.id
    WHERE g.id = ?
  `, [gutscheinId]);

  // PDF generieren
  const pdfBuffer = await generateGutscheinPdf(fullGutschein);
  const pdfFilename = `gutschein-${gutscheinId}-${code}.pdf`;
  const pdfPath = path.join(PDF_DIR, pdfFilename);
  fs.writeFileSync(pdfPath, pdfBuffer);

  // PDF-Pfad in DB speichern
  await pool.query(
    'UPDATE gutscheine SET pdf_pfad = ? WHERE id = ?',
    [`gutscheine-pdf/${pdfFilename}`, gutscheinId]
  );

  return { gutscheinId, code, pdfToken };
}

// POST /api/gutscheine/shop/:dojoId/paypal/create — PayPal Order erstellen
router.post('/shop/:dojoId/paypal/create', async (req, res) => {
  try {
    const dojoId = parseInt(req.params.dojoId, 10);
    if (!dojoId) return res.status(400).json({ error: 'Ungültige Dojo-ID' });

    // PayPal-Config laden
    const [[integrations]] = await pool.query(
      `SELECT di.paypal_client_id, di.paypal_client_secret, di.paypal_sandbox,
              d.dojoname
       FROM dojo d
       LEFT JOIN dojo_integrations di ON di.dojo_id = d.id
       WHERE d.id = ?`,
      [dojoId]
    );
    if (!integrations?.paypal_client_id) {
      return res.status(400).json({ error: 'PayPal nicht konfiguriert' });
    }

    const wert = parseFloat(req.body.wert);
    if (isNaN(wert) || wert <= 0) return res.status(400).json({ error: 'Ungültiger Wert' });

    const paypal = new PayPalProvider({
      paypal_client_id:     integrations.paypal_client_id,
      paypal_client_secret: integrations.paypal_client_secret,
      paypal_sandbox:       integrations.paypal_sandbox,
      dojoname:             integrations.dojoname,
    });

    // PayPal Order erstellen (ohne mitgliedId/rechnungId — direkt via API)
    const token = await paypal.getAccessToken();
    const baseUrl = integrations.paypal_sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const axios = require('axios');
    const orderRes = await axios.post(
      `${baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `GS-${Date.now()}`,
          description:  `Gutschein ${wert.toFixed(2)} EUR — ${integrations.dojoname}`,
          amount: { currency_code: 'EUR', value: wert.toFixed(2) },
        }],
        application_context: {
          brand_name:  integrations.dojoname || 'Kampfkunstschule',
          locale:      'de-DE',
          user_action: 'PAY_NOW',
        },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    // Pending-Daten zwischenspeichern (werden beim Capture gebraucht)
    res.json({ success: true, orderId: orderRes.data.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/gutscheine/shop/:dojoId/paypal/capture — PayPal Capture + PDF
router.post('/shop/:dojoId/paypal/capture', async (req, res) => {
  try {
    const dojoId = parseInt(req.params.dojoId, 10);
    const { orderId, ...gutscheinData } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId fehlt' });

    // PayPal-Config laden
    const [[integrations]] = await pool.query(
      'SELECT paypal_client_id, paypal_client_secret, paypal_sandbox FROM dojo_integrations WHERE dojo_id = ?',
      [dojoId]
    );
    if (!integrations?.paypal_client_id) return res.status(400).json({ error: 'PayPal nicht konfiguriert' });

    const paypal = new PayPalProvider({
      paypal_client_id:     integrations.paypal_client_id,
      paypal_client_secret: integrations.paypal_client_secret,
      paypal_sandbox:       integrations.paypal_sandbox,
    });

    // Capture
    const axios = require('axios');
    const token   = await paypal.getAccessToken();
    const baseUrl = integrations.paypal_sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const captureRes = await axios.post(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    if (captureRes.data.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'PayPal Zahlung nicht abgeschlossen' });
    }

    const paidAmount = parseFloat(
      captureRes.data.purchase_units[0]?.payments?.captures[0]?.amount?.value || gutscheinData.wert
    );

    const { code, pdfToken } = await createAndPayGutschein(
      dojoId, gutscheinData, 'paypal', orderId, paidAmount
    );

    res.json({
      success:    true,
      code,
      pdf_token:  pdfToken,
      download_url: `/api/gutscheine/pdf/${pdfToken}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/gutscheine/shop/:dojoId/stripe/intent — Stripe PaymentIntent erstellen
router.post('/shop/:dojoId/stripe/intent', async (req, res) => {
  try {
    const dojoId = parseInt(req.params.dojoId, 10);
    if (!dojoId) return res.status(400).json({ error: 'Ungültige Dojo-ID' });

    const wert = parseFloat(req.body.wert);
    if (isNaN(wert) || wert <= 0) return res.status(400).json({ error: 'Ungültiger Wert' });

    // Stripe-Keys laden
    const [[shopSettings]] = await pool.query(
      'SELECT stripe_secret_key, stripe_publishable_key FROM shop_einstellungen WHERE dojo_id = ?',
      [dojoId]
    );
    if (!shopSettings?.stripe_secret_key) {
      return res.status(400).json({ error: 'Stripe nicht konfiguriert' });
    }

    const stripe = require('stripe')(shopSettings.stripe_secret_key);
    const intent = await stripe.paymentIntents.create({
      amount:   Math.round(wert * 100), // Cent
      currency: 'eur',
      metadata: { dojo_id: String(dojoId), type: 'gutschein', wert: String(wert) },
    });

    res.json({
      success:         true,
      client_secret:   intent.client_secret,
      payment_intent_id: intent.id,
      publishable_key: shopSettings.stripe_publishable_key,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/gutscheine/shop/:dojoId/stripe/confirm — Nach erfolgreicher Stripe-Zahlung
router.post('/shop/:dojoId/stripe/confirm', async (req, res) => {
  try {
    const dojoId = parseInt(req.params.dojoId, 10);
    const { payment_intent_id, ...gutscheinData } = req.body;
    if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id fehlt' });

    // Stripe-Secret laden
    const [[shopSettings]] = await pool.query(
      'SELECT stripe_secret_key FROM shop_einstellungen WHERE dojo_id = ?',
      [dojoId]
    );
    if (!shopSettings?.stripe_secret_key) return res.status(400).json({ error: 'Stripe nicht konfiguriert' });

    // Zahlung server-seitig verifizieren
    const stripe = require('stripe')(shopSettings.stripe_secret_key);
    const intent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: `Zahlung nicht bestätigt (Status: ${intent.status})` });
    }

    const paidAmount = intent.amount / 100;

    const { code, pdfToken } = await createAndPayGutschein(
      dojoId, gutscheinData, 'stripe', payment_intent_id, paidAmount
    );

    res.json({
      success:     true,
      code,
      pdf_token:   pdfToken,
      download_url: `/api/gutscheine/pdf/${pdfToken}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Auth-geschützte Routes ────────────────────────────────────────────────────

router.use(authenticateToken);
router.use(requireFeature('gutscheine'));

// GET /api/gutscheine/vorlagen?anlass=geburtstag
router.get('/vorlagen', async (req, res) => {
  try {
    const { anlass } = req.query;
    let query = 'SELECT * FROM gutschein_vorlagen WHERE aktiv = 1';
    const params = [];
    if (anlass) { query += ' AND anlass = ?'; params.push(anlass); }
    query += ' ORDER BY anlass, sort_order, id';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, vorlagen: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/gutscheine — Liste aller Gutscheine des Dojos
router.get('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID fehlt' });

    const { eingeloest, search } = req.query;
    let query = `
      SELECT g.*, v.bild_url, v.anlass, v.titel AS vorlage_titel
      FROM gutscheine g
      JOIN gutschein_vorlagen v ON g.vorlage_id = v.id
      WHERE g.dojo_id = ?
    `;
    const params = [dojoId];
    if (eingeloest !== undefined) { query += ' AND g.eingeloest = ?'; params.push(eingeloest === 'true' ? 1 : 0); }
    if (search) { query += ' AND (g.code LIKE ? OR g.empfaenger_name LIKE ? OR g.empfaenger_email LIKE ?)'; const like = `%${search}%`; params.push(like, like, like); }
    query += ' ORDER BY g.erstellt_am DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, gutscheine: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/gutscheine/stats
router.get('/stats', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID fehlt' });

    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) AS gesamt,
        SUM(eingeloest = 0) AS offen,
        SUM(eingeloest = 1) AS eingeloest,
        SUM(CASE WHEN eingeloest = 0 THEN wert ELSE 0 END) AS wert_offen,
        SUM(CASE WHEN eingeloest = 1 THEN wert ELSE 0 END) AS wert_eingeloest
      FROM gutscheine WHERE dojo_id = ?
    `, [dojoId]);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/gutscheine — Neuen Gutschein erstellen
router.post('/', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID fehlt' });

    const { vorlage_id, wert, titel, nachricht, gueltig_bis, empfaenger_name, empfaenger_email } = req.body;
    if (!vorlage_id || !wert || !titel) {
      return res.status(400).json({ success: false, error: 'vorlage_id, wert und titel sind Pflicht' });
    }
    if (isNaN(parseFloat(wert)) || parseFloat(wert) <= 0) {
      return res.status(400).json({ success: false, error: 'Ungültiger Wert' });
    }

    // Vorlage existiert?
    const [[vorlage]] = await pool.query('SELECT id FROM gutschein_vorlagen WHERE id = ? AND aktiv = 1', [vorlage_id]);
    if (!vorlage) return res.status(404).json({ success: false, error: 'Vorlage nicht gefunden' });

    const code = await uniqueCode();
    const userId = req.user?.id || req.user?.user_id || null;

    const [result] = await pool.query(`
      INSERT INTO gutscheine
        (dojo_id, vorlage_id, code, wert, titel, nachricht, gueltig_bis, empfaenger_name, empfaenger_email, erstellt_von)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [dojoId, vorlage_id, code, parseFloat(wert), titel.trim(),
        nachricht || null, gueltig_bis || null,
        empfaenger_name || null, empfaenger_email || null, userId]);

    const [[neu]] = await pool.query(`
      SELECT g.*, v.bild_url, v.anlass
      FROM gutscheine g JOIN gutschein_vorlagen v ON g.vorlage_id = v.id
      WHERE g.id = ?
    `, [result.insertId]);

    res.json({ success: true, gutschein: neu });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/gutscheine/:id — Bearbeiten (nur nicht eingelöste)
router.put('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID fehlt' });

    const [[g]] = await pool.query('SELECT * FROM gutscheine WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    if (!g) return res.status(404).json({ success: false, error: 'Gutschein nicht gefunden' });
    if (g.eingeloest) return res.status(400).json({ success: false, error: 'Eingelöste Gutscheine können nicht bearbeitet werden' });

    const { wert, titel, nachricht, gueltig_bis, empfaenger_name, empfaenger_email } = req.body;
    await pool.query(`
      UPDATE gutscheine SET wert=?, titel=?, nachricht=?, gueltig_bis=?, empfaenger_name=?, empfaenger_email=?
      WHERE id = ? AND dojo_id = ?
    `, [wert ?? g.wert, titel ?? g.titel, nachricht ?? g.nachricht,
        gueltig_bis ?? g.gueltig_bis, empfaenger_name ?? g.empfaenger_name,
        empfaenger_email ?? g.empfaenger_email, req.params.id, dojoId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/gutscheine/:id/einloesen — Als eingelöst markieren
router.put('/:id/einloesen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID fehlt' });

    const [result] = await pool.query(`
      UPDATE gutscheine SET eingeloest = 1, eingeloest_am = CURDATE()
      WHERE id = ? AND dojo_id = ? AND eingeloest = 0
    `, [req.params.id, dojoId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Gutschein nicht gefunden oder bereits eingelöst' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/gutscheine/:id
router.delete('/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ success: false, error: 'Dojo-ID fehlt' });

    const [[g]] = await pool.query('SELECT eingeloest FROM gutscheine WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    if (!g) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    if (g.eingeloest) return res.status(400).json({ success: false, error: 'Eingelöste Gutscheine können nicht gelöscht werden' });

    await pool.query('DELETE FROM gutscheine WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Super-Admin: Vorlagen verwalten ─────────────────────────────────────────

// POST /api/gutscheine/admin/vorlagen — Neue Vorlage anlegen (Super-Admin)
router.post('/admin/vorlagen', async (req, res) => {
  const role = req.user?.rolle || req.user?.role;
  if (role !== 'super_admin' && !(role === 'admin' && !req.user?.dojo_id)) {
    return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  }
  try {
    const { anlass, titel, bild_pfad, bild_url, sort_order } = req.body;
    if (!anlass || !titel || !bild_pfad) {
      return res.status(400).json({ success: false, error: 'anlass, titel, bild_pfad fehlen' });
    }
    const [result] = await pool.query(
      'INSERT INTO gutschein_vorlagen (anlass, titel, bild_pfad, bild_url, sort_order) VALUES (?, ?, ?, ?, ?)',
      [anlass, titel, bild_pfad, bild_url || null, sort_order || 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/gutscheine/admin/vorlagen/:id — Vorlage löschen (Super-Admin)
router.delete('/admin/vorlagen/:id', async (req, res) => {
  const role = req.user?.rolle || req.user?.role;
  if (role !== 'super_admin' && !(role === 'admin' && !req.user?.dojo_id)) {
    return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  }
  try {
    await pool.query('UPDATE gutschein_vorlagen SET aktiv = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
