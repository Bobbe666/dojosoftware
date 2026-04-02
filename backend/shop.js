/**
 * SHOP ROUTES — Multi-Tenant
 * ===========================
 * TDA-Zentralshop (dojo_id = NULL) + Dojo-Shops (dojo_id = X)
 *
 * Public: /api/shop/public/:dojoRef/...  (kein Login nötig)
 * Admin:  /api/shop/admin/...            (Admin-Auth erforderlich)
 *
 * dojoRef: 'tda' oder '0' → TDA-Zentralshop (dojo_id IS NULL)
 *          '5' / 5        → Dojo mit id=5
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Wandelt dojoRef ('tda', '0', '5') in dojo_id (null oder Int) um
 */
function resolveDojoRef(dojoRef) {
  if (!dojoRef || dojoRef === 'tda' || dojoRef === '0') return null;
  const parsed = parseInt(dojoRef, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Gibt SQL-Bedingung und Params für dojo_id-Filter zurück
 */
function dojoWhere(dojoId) {
  if (dojoId === null) return { sql: 'dojo_id IS NULL', params: [] };
  return { sql: 'dojo_id = ?', params: [dojoId] };
}

/**
 * Liest Stripe-Keys aus shop_einstellungen für ein Dojo
 */
async function getStripeKeys(dojoId) {
  const { sql, params } = dojoWhere(dojoId);
  const [rows] = await db.promise().query(
    `SELECT stripe_secret_key, stripe_publishable_key, stripe_webhook_secret FROM shop_einstellungen WHERE ${sql}`,
    params
  );
  return rows[0] || null;
}

/**
 * Liest Shop-Einstellungen (ohne sensitive Keys) für Public
 */
async function getPublicEinstellungen(dojoId) {
  const { sql, params } = dojoWhere(dojoId);
  const [rows] = await db.promise().query(
    `SELECT shop_aktiv, shop_name, shop_beschreibung, shop_logo_url,
            versandkostenfrei_ab_cent, standard_versandkosten_cent,
            rechnung_erlaubt, stripe_publishable_key
     FROM shop_einstellungen WHERE ${sql}`,
    params
  );
  return rows[0] || null;
}

/**
 * Admin-Middleware: Prüft ob der User Admin ist
 */
const requireAdmin = (req, res, next) => {
  const role = req.user?.role || req.user?.rolle;
  if (role === 'admin' || role === 'super_admin') return next();
  return res.status(403).json({ error: 'Admin-Berechtigung erforderlich' });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ÖFFENTLICHE ROUTEN — kein Login nötig
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/shop/public/:dojoRef/einstellungen
 * Shop-Infos (Name, Logo, Versandkosten, Publishable-Key) — keine geheimen Keys
 */
router.get('/public/:dojoRef/einstellungen', async (req, res) => {
  try {
    const dojoId = resolveDojoRef(req.params.dojoRef);
    const einstellungen = await getPublicEinstellungen(dojoId);

    if (!einstellungen) {
      return res.status(404).json({ error: 'Shop nicht gefunden' });
    }
    if (!einstellungen.shop_aktiv) {
      return res.status(403).json({ error: 'Dieser Shop ist nicht aktiv' });
    }

    res.json(einstellungen);
  } catch (error) {
    logger.error('Shop-Einstellungen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Shop-Einstellungen' });
  }
});

/**
 * GET /api/shop/public/:dojoRef/kategorien
 */
router.get('/public/:dojoRef/kategorien', async (req, res) => {
  try {
    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { sql, params } = dojoWhere(dojoId);

    const [kategorien] = await db.promise().query(`
      SELECT k.*,
             p.name AS parent_name,
             (SELECT COUNT(*) FROM shop_produkte
              WHERE kategorie_id = k.id AND aktiv = TRUE) AS produkt_anzahl
      FROM shop_kategorien k
      LEFT JOIN shop_kategorien p ON k.parent_id = p.id
      WHERE k.aktiv = TRUE AND k.${sql}
      ORDER BY k.parent_id IS NULL DESC, k.sortierung, k.name
    `, params);

    // Hierarchie aufbauen
    const parents = kategorien.filter(k => !k.parent_id);
    const result = parents.map(parent => ({
      ...parent,
      children: kategorien.filter(k => k.parent_id === parent.id)
    }));

    res.json(result);
  } catch (error) {
    logger.error('Kategorien Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

/**
 * GET /api/shop/public/:dojoRef/produkte
 * Query: ?kategorie=slug&featured=true&search=text&typ=pass
 */
router.get('/public/:dojoRef/produkte', async (req, res) => {
  try {
    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { kategorie, featured, search, typ } = req.query;
    const { sql: dojoSql, params: dojoParams } = dojoWhere(dojoId);

    let query = `
      SELECT p.*, k.name AS kategorie_name, k.slug AS kategorie_slug,
             pk.name AS parent_kategorie_name, pk.id AS parent_kategorie_id
      FROM shop_produkte p
      JOIN shop_kategorien k ON p.kategorie_id = k.id
      LEFT JOIN shop_kategorien pk ON k.parent_id = pk.id
      WHERE p.aktiv = TRUE AND p.${dojoSql}
    `;
    const params = [...dojoParams];

    if (kategorie) {
      query += ` AND (k.slug = ? OR k.parent_id = (SELECT id FROM shop_kategorien WHERE slug = ?))`;
      params.push(kategorie, kategorie);
    }
    if (featured === 'true') {
      query += ` AND p.featured = TRUE`;
    }
    if (typ) {
      query += ` AND p.typ = ?`;
      params.push(typ);
    }
    if (search) {
      query += ` AND (p.name LIKE ? OR p.beschreibung LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.featured DESC, k.sortierung, p.name`;

    const [produkte] = await db.promise().query(query, params);

    const result = produkte.map(p => ({
      ...p,
      details: typeof p.details === 'string' ? JSON.parse(p.details || '{}') : (p.details || {}),
      optionen: typeof p.optionen === 'string' ? JSON.parse(p.optionen || '{}') : (p.optionen || {})
    }));

    res.json(result);
  } catch (error) {
    logger.error('Produkte Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
  }
});

/**
 * GET /api/shop/public/:dojoRef/produkte/:id
 */
router.get('/public/:dojoRef/produkte/:id', async (req, res) => {
  try {
    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { sql, params } = dojoWhere(dojoId);

    const [produkte] = await db.promise().query(`
      SELECT p.*, k.name AS kategorie_name, k.slug AS kategorie_slug,
             pk.name AS parent_kategorie_name, pk.id AS parent_kategorie_id
      FROM shop_produkte p
      JOIN shop_kategorien k ON p.kategorie_id = k.id
      LEFT JOIN shop_kategorien pk ON k.parent_id = pk.id
      WHERE p.id = ? AND p.aktiv = TRUE AND p.${sql}
    `, [req.params.id, ...params]);

    if (produkte.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    const p = produkte[0];
    res.json({
      ...p,
      details: typeof p.details === 'string' ? JSON.parse(p.details || '{}') : (p.details || {}),
      optionen: typeof p.optionen === 'string' ? JSON.parse(p.optionen || '{}') : (p.optionen || {})
    });
  } catch (error) {
    logger.error('Produkt Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden des Produkts' });
  }
});

/**
 * POST /api/shop/public/:dojoRef/checkout
 * Guest-Checkout — kein Login nötig
 * Body: { positionen, lieferadresse, zahlungsart, kundennotiz }
 * positionen: [{ produkt_id, menge, optionen?, mitglied_id?, personalisierung? }]
 */
router.post('/public/:dojoRef/checkout', async (req, res) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { positionen, lieferadresse, zahlungsart, kundennotiz } = req.body;
    const { sql: dojoSql, params: dojoParams } = dojoWhere(dojoId);

    // Validierung
    if (!positionen || !Array.isArray(positionen) || positionen.length === 0) {
      return res.status(400).json({ error: 'Keine Produkte in der Bestellung' });
    }
    if (!lieferadresse?.vorname || !lieferadresse?.nachname || !lieferadresse?.strasse ||
        !lieferadresse?.plz || !lieferadresse?.ort || !lieferadresse?.email) {
      return res.status(400).json({ error: 'Lieferadresse unvollständig' });
    }

    // Shop-Einstellungen laden
    const einstellungen = await getPublicEinstellungen(dojoId);
    if (!einstellungen || !einstellungen.shop_aktiv) {
      return res.status(403).json({ error: 'Dieser Shop ist nicht aktiv' });
    }

    // Zahlungsart prüfen
    const zahlungsartNorm = zahlungsart || 'rechnung';
    if (zahlungsartNorm === 'rechnung' && !einstellungen.rechnung_erlaubt) {
      return res.status(400).json({ error: 'Kauf auf Rechnung nicht verfügbar' });
    }
    if (zahlungsartNorm === 'stripe' && !einstellungen.stripe_publishable_key) {
      return res.status(400).json({ error: 'Kartenzahlung momentan nicht verfügbar' });
    }

    // Produkte validieren und Preise berechnen
    let zwischensumme_cent = 0;
    const validatedPositionen = [];

    for (const pos of positionen) {
      if (!pos.produkt_id || !pos.menge || pos.menge < 1) {
        return res.status(400).json({ error: 'Ungültige Bestellposition' });
      }

      const [produkte] = await connection.query(
        `SELECT id, name, preis, aktiv, lagerbestand FROM shop_produkte
         WHERE id = ? AND aktiv = TRUE AND ${dojoSql}`,
        [pos.produkt_id, ...dojoParams]
      );

      if (produkte.length === 0) {
        return res.status(400).json({ error: `Produkt ${pos.produkt_id} nicht gefunden` });
      }

      const produkt = produkte[0];

      // Lagerbestand prüfen (-1 = unbegrenzt)
      if (produkt.lagerbestand !== -1 && produkt.lagerbestand < pos.menge) {
        return res.status(400).json({ error: `Produkt "${produkt.name}" nicht in ausreichender Menge verfügbar` });
      }

      const einzelpreis_cent = Math.round(parseFloat(produkt.preis) * 100);
      zwischensumme_cent += einzelpreis_cent * pos.menge;

      validatedPositionen.push({
        produkt_id: produkt.id,
        produkt_name: produkt.name,
        menge: pos.menge,
        einzelpreis_cent,
        gesamtpreis_cent: einzelpreis_cent * pos.menge,
        mitglied_id: pos.mitglied_id || null,
        personalisierung: pos.personalisierung ? JSON.stringify(pos.personalisierung) : null,
        optionen: pos.optionen ? JSON.stringify(pos.optionen) : null,
        produkt_variante: pos.optionen?.groesse || pos.optionen?.variante || null
      });
    }

    // Versandkosten berechnen
    const versandkosten_cent = zwischensumme_cent >= einstellungen.versandkostenfrei_ab_cent
      ? 0
      : einstellungen.standard_versandkosten_cent;
    const gesamtbetrag_cent = zwischensumme_cent + versandkosten_cent;

    // Bestellnummer generieren
    const bestellnummer = 'TDA-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // Bestellung anlegen
    const [bestellResult] = await connection.query(`
      INSERT INTO shop_bestellungen
      (dojo_id, bestellnummer, gast_bestellung, kunde_name, kunde_email,
       lieferadresse_strasse, lieferadresse_plz, lieferadresse_ort, lieferadresse_land,
       zwischensumme_cent, versandkosten_cent, gesamtbetrag_cent,
       status, zahlungsart, bezahlt, kundennotiz)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, 0, ?)
    `, [
      dojoId,
      bestellnummer,
      `${lieferadresse.vorname} ${lieferadresse.nachname}`.trim(),
      lieferadresse.email,
      lieferadresse.strasse,
      lieferadresse.plz,
      lieferadresse.ort,
      lieferadresse.land || 'Deutschland',
      zwischensumme_cent,
      versandkosten_cent,
      gesamtbetrag_cent,
      zahlungsartNorm,
      kundennotiz || null
    ]);

    const bestellungId = bestellResult.insertId;

    // Positionen anlegen
    for (const pos of validatedPositionen) {
      await connection.query(`
        INSERT INTO shop_bestellpositionen
        (bestellung_id, produkt_id, produkt_name, produkt_variante, menge,
         einzelpreis_cent, gesamtpreis_cent, mitglied_id, personalisierung, optionen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [bestellungId, pos.produkt_id, pos.produkt_name, pos.produkt_variante,
          pos.menge, pos.einzelpreis_cent, pos.gesamtpreis_cent,
          pos.mitglied_id, pos.personalisierung, pos.optionen]);

      // Lagerbestand reduzieren (falls nicht unbegrenzt)
      await connection.query(
        `UPDATE shop_produkte SET lagerbestand = lagerbestand - ?
         WHERE id = ? AND lagerbestand != -1`,
        [pos.menge, pos.produkt_id]
      );
    }

    await connection.commit();

    // Stripe PaymentIntent erstellen (falls nötig)
    let client_secret = null;
    if (zahlungsartNorm === 'stripe') {
      try {
        const keys = await getStripeKeys(dojoId);
        if (keys?.stripe_secret_key) {
          const stripe = require('stripe')(keys.stripe_secret_key);
          const paymentIntent = await stripe.paymentIntents.create({
            amount: gesamtbetrag_cent,
            currency: 'eur',
            metadata: {
              bestellnummer,
              bestellung_id: String(bestellungId),
              dojo_id: String(dojoId ?? 'tda')
            }
          });
          // PaymentIntent-ID speichern
          await db.promise().query(
            'UPDATE shop_bestellungen SET stripe_payment_intent_id = ? WHERE id = ?',
            [paymentIntent.id, bestellungId]
          );
          client_secret = paymentIntent.client_secret;
        }
      } catch (stripeErr) {
        logger.error('Stripe PaymentIntent Fehler:', { error: stripeErr });
        // Bestellung bleibt bestehen, Zahlung muss erneut versucht werden
      }
    }

    res.status(201).json({
      success: true,
      bestellnummer,
      bestellung_id: bestellungId,
      zwischensumme: zwischensumme_cent / 100,
      versandkosten: versandkosten_cent / 100,
      gesamtbetrag: gesamtbetrag_cent / 100,
      zahlungsart: zahlungsartNorm,
      client_secret // null wenn nicht Stripe
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Checkout Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Erstellen der Bestellung', details: error.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/shop/public/bestellung/:bestellnummer
 * Bestellstatus für Bestätigungsseite (öffentlich via Bestellnummer)
 */
router.get('/public/bestellung/:bestellnummer', async (req, res) => {
  try {
    const [bestellungen] = await db.promise().query(`
      SELECT b.bestellnummer, b.kunde_name, b.kunde_email,
             b.status, b.zahlungsart, b.bezahlt,
             b.zwischensumme_cent, b.versandkosten_cent, b.gesamtbetrag_cent,
             b.lieferadresse_strasse, b.lieferadresse_plz, b.lieferadresse_ort, b.lieferadresse_land,
             b.bestellt_am, b.tracking_nummer, b.versand_dienstleister
      FROM shop_bestellungen b
      WHERE b.bestellnummer = ?
    `, [req.params.bestellnummer]);

    if (bestellungen.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    const bestellung = bestellungen[0];

    // Positionen laden
    const [positionen] = await db.promise().query(`
      SELECT bp.produkt_name, bp.produkt_variante, bp.menge,
             bp.einzelpreis_cent, bp.gesamtpreis_cent, bp.personalisierung, bp.optionen
      FROM shop_bestellpositionen bp
      WHERE bp.bestellung_id = (SELECT id FROM shop_bestellungen WHERE bestellnummer = ?)
    `, [req.params.bestellnummer]);

    bestellung.positionen = positionen.map(p => ({
      ...p,
      personalisierung: typeof p.personalisierung === 'string'
        ? JSON.parse(p.personalisierung || 'null')
        : p.personalisierung,
      optionen: typeof p.optionen === 'string'
        ? JSON.parse(p.optionen || 'null')
        : p.optionen
    }));

    res.json(bestellung);
  } catch (error) {
    logger.error('Bestellung laden Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellung' });
  }
});

/**
 * POST /api/shop/stripe/webhook
 * Stripe Webhook — Zahlung abgeschlossen
 * Body wird von globalem JSON-Parser bereits geparst
 */
router.post('/stripe/webhook', async (req, res) => {
  try {
    const event = req.body;
    if (!event || !event.type) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      const bestellnummer = intent.metadata?.bestellnummer;

      if (bestellnummer) {
        await db.promise().query(
          `UPDATE shop_bestellungen
           SET bezahlt = 1, bezahlt_am = NOW(), status = 'in_bearbeitung'
           WHERE bestellnummer = ? AND bezahlt = 0`,
          [bestellnummer]
        );
        logger.info(`Shop-Zahlung erhalten: ${bestellnummer}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe Webhook Fehler:', { error });
    res.status(500).json({ error: 'Webhook-Fehler' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTEN — Login + Admin-Rolle erforderlich
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/shop/admin/einstellungen
 */
router.get('/admin/einstellungen', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    const [rows] = await db.promise().query(
      `SELECT * FROM shop_einstellungen WHERE ${sql}`,
      params
    );

    if (rows.length === 0) {
      // Automatisch anlegen
      await db.promise().query(
        `INSERT INTO shop_einstellungen (dojo_id, shop_aktiv, shop_name) VALUES (?, 0, ?)`,
        [secureDojoId, secureDojoId ? 'Dojo Shop' : 'TDA Shop']
      );
      const [newRows] = await db.promise().query(
        `SELECT * FROM shop_einstellungen WHERE ${sql}`, params
      );
      return res.json(newRows[0] || {});
    }

    // stripe_secret_key maskieren
    const einstellungen = { ...rows[0] };
    if (einstellungen.stripe_secret_key) {
      einstellungen.stripe_secret_key_masked = '****' +
        einstellungen.stripe_secret_key.slice(-4);
      delete einstellungen.stripe_secret_key;
    }

    res.json(einstellungen);
  } catch (error) {
    logger.error('Admin-Einstellungen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Einstellungen' });
  }
});

/**
 * PUT /api/shop/admin/einstellungen
 */
router.put('/admin/einstellungen', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const {
      shop_aktiv, shop_name, shop_beschreibung, shop_logo_url,
      stripe_publishable_key, stripe_secret_key, stripe_webhook_secret,
      versandkostenfrei_ab_cent, standard_versandkosten_cent, rechnung_erlaubt,
      impressum_zusatz
    } = req.body;

    const { sql, params } = dojoWhere(secureDojoId);

    // Prüfen ob Eintrag existiert
    const [existing] = await db.promise().query(
      `SELECT id FROM shop_einstellungen WHERE ${sql}`, params
    );

    const updateFields = {
      shop_aktiv: shop_aktiv !== undefined ? shop_aktiv : undefined,
      shop_name,
      shop_beschreibung,
      shop_logo_url,
      stripe_publishable_key,
      versandkostenfrei_ab_cent,
      standard_versandkosten_cent,
      rechnung_erlaubt,
      impressum_zusatz
    };
    // Stripe-Secret nur updaten wenn neuer Wert übergeben (nicht leer, nicht maskiert)
    if (stripe_secret_key && !stripe_secret_key.startsWith('****')) {
      updateFields.stripe_secret_key = stripe_secret_key;
    }
    if (stripe_webhook_secret && !stripe_webhook_secret.startsWith('****')) {
      updateFields.stripe_webhook_secret = stripe_webhook_secret;
    }

    // Undefined-Felder entfernen
    Object.keys(updateFields).forEach(k => updateFields[k] === undefined && delete updateFields[k]);

    if (existing.length === 0) {
      await db.promise().query(
        `INSERT INTO shop_einstellungen SET dojo_id = ?, ${Object.keys(updateFields).map(k => `${k} = ?`).join(', ')}`,
        [secureDojoId, ...Object.values(updateFields)]
      );
    } else {
      await db.promise().query(
        `UPDATE shop_einstellungen SET ${Object.keys(updateFields).map(k => `${k} = ?`).join(', ')} WHERE ${sql}`,
        [...Object.values(updateFields), ...params]
      );
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Admin-Einstellungen Update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Speichern der Einstellungen' });
  }
});

/**
 * GET /api/shop/admin/produkte
 * Query: ?dojo_id=X (nur Super-Admin), ?alle=true (alle, nur Super-Admin)
 */
router.get('/admin/produkte', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    const [produkte] = await db.promise().query(`
      SELECT p.*, k.name AS kategorie_name, k.slug AS kategorie_slug,
             pk.name AS parent_kategorie_name
      FROM shop_produkte p
      JOIN shop_kategorien k ON p.kategorie_id = k.id
      LEFT JOIN shop_kategorien pk ON k.parent_id = pk.id
      WHERE p.${sql}
      ORDER BY k.sortierung, p.name
    `, params);

    res.json(produkte.map(p => ({
      ...p,
      details: typeof p.details === 'string' ? JSON.parse(p.details || '{}') : (p.details || {}),
      optionen: typeof p.optionen === 'string' ? JSON.parse(p.optionen || '{}') : (p.optionen || {})
    })));
  } catch (error) {
    logger.error('Admin-Produkte Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
  }
});

/**
 * POST /api/shop/admin/produkte
 */
router.post('/admin/produkte', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const {
      kategorie_id, sku, name, beschreibung, preis, bild_url,
      details, optionen, lieferzeit, featured, aktiv, typ, lagerbestand
    } = req.body;

    if (!name || !preis || !kategorie_id) {
      return res.status(400).json({ error: 'Name, Preis und Kategorie sind erforderlich' });
    }

    const [result] = await db.promise().query(`
      INSERT INTO shop_produkte
      (dojo_id, kategorie_id, sku, name, beschreibung, preis, bild_url,
       details, optionen, lieferzeit, featured, aktiv, typ, lagerbestand)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      secureDojoId, kategorie_id, sku || null, name, beschreibung || null,
      preis, bild_url || null,
      JSON.stringify(details || {}), JSON.stringify(optionen || {}),
      lieferzeit || '3-5 Werktage', featured ? 1 : 0, aktiv !== false ? 1 : 0,
      typ || 'standard', lagerbestand !== undefined ? lagerbestand : -1
    ]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Produkt erstellen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Erstellen des Produkts' });
  }
});

/**
 * PUT /api/shop/admin/produkte/:id
 */
router.put('/admin/produkte/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);
    const {
      kategorie_id, sku, name, beschreibung, preis, bild_url,
      details, optionen, lieferzeit, featured, aktiv, typ, lagerbestand
    } = req.body;

    // Sicherheit: Nur eigene Produkte bearbeiten
    const [check] = await db.promise().query(
      `SELECT id FROM shop_produkte WHERE id = ? AND ${sql}`,
      [req.params.id, ...params]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    await db.promise().query(`
      UPDATE shop_produkte SET
        kategorie_id = ?, sku = ?, name = ?, beschreibung = ?, preis = ?, bild_url = ?,
        details = ?, optionen = ?, lieferzeit = ?, featured = ?, aktiv = ?, typ = ?, lagerbestand = ?
      WHERE id = ?
    `, [
      kategorie_id, sku || null, name, beschreibung || null, preis, bild_url || null,
      JSON.stringify(details || {}), JSON.stringify(optionen || {}),
      lieferzeit || '3-5 Werktage', featured ? 1 : 0, aktiv !== false ? 1 : 0,
      typ || 'standard', lagerbestand !== undefined ? lagerbestand : -1,
      req.params.id
    ]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Produkt update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Produkts' });
  }
});

/**
 * DELETE /api/shop/admin/produkte/:id (Soft-Delete)
 */
router.delete('/admin/produkte/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    await db.promise().query(
      `UPDATE shop_produkte SET aktiv = FALSE WHERE id = ? AND ${sql}`,
      [req.params.id, ...params]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Produkt löschen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Löschen des Produkts' });
  }
});

/**
 * GET /api/shop/admin/kategorien
 */
router.get('/admin/kategorien', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    const [kategorien] = await db.promise().query(`
      SELECT k.*, p.name AS parent_name,
             (SELECT COUNT(*) FROM shop_produkte WHERE kategorie_id = k.id) AS produkt_anzahl
      FROM shop_kategorien k
      LEFT JOIN shop_kategorien p ON k.parent_id = p.id
      WHERE k.${sql}
      ORDER BY k.parent_id IS NULL DESC, k.sortierung, k.name
    `, params);

    res.json(kategorien);
  } catch (error) {
    logger.error('Admin-Kategorien Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

/**
 * POST /api/shop/admin/kategorien
 */
router.post('/admin/kategorien', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name und Slug sind erforderlich' });
    }

    const [result] = await db.promise().query(`
      INSERT INTO shop_kategorien
      (dojo_id, name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [secureDojoId, name, slug, beschreibung || null, icon || null,
        farbe || '#3B82F6', sortierung || 0, parent_id || null, aktiv !== false ? 1 : 0]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Kategorie erstellen Fehler:', { error });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Slug bereits vergeben' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

/**
 * PUT /api/shop/admin/kategorien/:id
 */
router.put('/admin/kategorien/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);
    const { name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv } = req.body;

    await db.promise().query(`
      UPDATE shop_kategorien SET
        name = ?, slug = ?, beschreibung = ?, icon = ?, farbe = ?,
        sortierung = ?, parent_id = ?, aktiv = ?
      WHERE id = ? AND ${sql}
    `, [name, slug, beschreibung || null, icon || null, farbe || '#3B82F6',
        sortierung || 0, parent_id || null, aktiv !== false ? 1 : 0,
        req.params.id, ...params]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Kategorie update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
  }
});

/**
 * DELETE /api/shop/admin/kategorien/:id (Soft-Delete)
 */
router.delete('/admin/kategorien/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    await db.promise().query(
      `UPDATE shop_kategorien SET aktiv = FALSE WHERE id = ? AND ${sql}`,
      [req.params.id, ...params]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Kategorie löschen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Löschen der Kategorie' });
  }
});

/**
 * GET /api/shop/admin/bestellungen
 * Query: ?status=offen&dojo_id=X&page=1&limit=50
 */
router.get('/admin/bestellungen', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId);

    let query = `
      SELECT b.*,
             (SELECT COUNT(*) FROM shop_bestellpositionen WHERE bestellung_id = b.id) AS anzahl_positionen
      FROM shop_bestellungen b
      WHERE b.${dojoSql}
    `;
    const params = [...dojoParams];

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY b.bestellt_am DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [bestellungen] = await db.promise().query(query, params);

    // Gesamtanzahl für Pagination
    const [countResult] = await db.promise().query(
      `SELECT COUNT(*) AS total FROM shop_bestellungen b WHERE b.${dojoSql}${status ? ' AND b.status = ?' : ''}`,
      status ? [...dojoParams, status] : dojoParams
    );

    res.json({
      bestellungen,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('Admin-Bestellungen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
  }
});

/**
 * GET /api/shop/admin/bestellungen/:id
 */
router.get('/admin/bestellungen/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    const [bestellungen] = await db.promise().query(
      `SELECT b.* FROM shop_bestellungen b WHERE b.id = ? AND b.${sql}`,
      [req.params.id, ...params]
    );

    if (bestellungen.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    const bestellung = bestellungen[0];

    const [positionen] = await db.promise().query(`
      SELECT bp.*, p.name AS produkt_name_aktuell, p.sku
      FROM shop_bestellpositionen bp
      LEFT JOIN shop_produkte p ON bp.produkt_id = p.id
      WHERE bp.bestellung_id = ?
    `, [req.params.id]);

    bestellung.positionen = positionen.map(p => ({
      ...p,
      personalisierung: typeof p.personalisierung === 'string'
        ? JSON.parse(p.personalisierung || 'null') : p.personalisierung,
      optionen: typeof p.optionen === 'string'
        ? JSON.parse(p.optionen || 'null') : p.optionen
    }));

    res.json(bestellung);
  } catch (error) {
    logger.error('Admin-Bestellung Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellung' });
  }
});

/**
 * PATCH /api/shop/admin/bestellungen/:id/status
 */
router.patch('/admin/bestellungen/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);
    const { status } = req.body;
    const validStatus = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert'];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    await db.promise().query(
      `UPDATE shop_bestellungen SET status = ? WHERE id = ? AND ${sql}`,
      [status, req.params.id, ...params]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Status update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
  }
});

/**
 * PATCH /api/shop/admin/bestellungen/:id/tracking
 */
router.patch('/admin/bestellungen/:id/tracking', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);
    const { tracking_nummer, versand_dienstleister } = req.body;

    await db.promise().query(
      `UPDATE shop_bestellungen SET tracking_nummer = ?, versand_dienstleister = ?, status = 'versendet'
       WHERE id = ? AND ${sql}`,
      [tracking_nummer || null, versand_dienstleister || null, req.params.id, ...params]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Tracking update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Trackings' });
  }
});

/**
 * GET /api/shop/admin/dashboard
 * KPIs: Bestellungen heute/Woche/Monat, Umsatz, Top-Produkte
 */
router.get('/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql, params } = dojoWhere(secureDojoId);

    const [stats] = await db.promise().query(`
      SELECT
        COUNT(*) AS bestellungen_gesamt,
        SUM(CASE WHEN DATE(bestellt_am) = CURDATE() THEN 1 ELSE 0 END) AS bestellungen_heute,
        SUM(CASE WHEN bestellt_am >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS bestellungen_woche,
        SUM(CASE WHEN bestellt_am >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS bestellungen_monat,
        SUM(CASE WHEN bezahlt = 1 THEN gesamtbetrag_cent ELSE 0 END) AS umsatz_gesamt_cent,
        SUM(CASE WHEN bezahlt = 1 AND bestellt_am >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            THEN gesamtbetrag_cent ELSE 0 END) AS umsatz_monat_cent,
        SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) AS offene_bestellungen
      FROM shop_bestellungen b
      WHERE b.${sql}
    `, params);

    const [topProdukte] = await db.promise().query(`
      SELECT bp.produkt_name, SUM(bp.menge) AS verkauft, SUM(bp.gesamtpreis_cent) AS umsatz_cent
      FROM shop_bestellpositionen bp
      JOIN shop_bestellungen b ON bp.bestellung_id = b.id
      WHERE b.${sql} AND b.bestellt_am >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY bp.produkt_id, bp.produkt_name
      ORDER BY verkauft DESC
      LIMIT 5
    `, params);

    res.json({
      stats: stats[0],
      top_produkte: topProdukte
    });
  } catch (error) {
    logger.error('Shop-Dashboard Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden des Dashboards' });
  }
});

module.exports = router;
