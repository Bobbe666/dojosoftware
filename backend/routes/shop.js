/**
 * SHOP ROUTES — Multi-Tenant
 * ===========================
 * TDA-Zentralshop (dojo_id = NULL) + Dojo-Shops (dojo_id = X)
 *
 * Produkte kommen aus der bestehenden `artikel`-Tabelle (shop_aktiv = 1).
 * Kategorien kommen aus `artikelgruppen`.
 * Bestellungen werden in `shop_bestellungen` + `shop_bestellpositionen` gespeichert.
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
function dojoWhere(dojoId, tableAlias) {
  const col = tableAlias ? `${tableAlias}.dojo_id` : 'dojo_id';
  if (dojoId === null) return { sql: `${col} IS NULL`, params: [] };
  return { sql: `${col} = ?`, params: [dojoId] };
}

/**
 * JSON-String sicher parsen — gibt null zurück wenn ungültig
 */
function parseJSON(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

/**
 * Normalisiert einen Artikel-Datensatz für die öffentliche API
 * Spaltenaliasse aus der Produkte-Query: kat_kategorie_id, kat_name, kat_icon, kat_farbe
 */
function normalizeArtikel(a) {
  const lagerbestand = a.lager_tracking ? (a.lagerbestand ?? 0) : null;
  const verfuegbar = !a.lager_tracking || (a.lagerbestand ?? 0) > 0;
  return {
    id: a.artikel_id,
    artikel_id: a.artikel_id,
    name: a.name,
    beschreibung: a.beschreibung || null,
    artikel_nummer: a.artikel_nummer || null,
    preis: a.verkaufspreis_cent / 100,
    preis_cent: a.verkaufspreis_cent,
    bild_url: a.bild_url || null,
    lager_tracking: !!a.lager_tracking,
    lagerbestand,
    verfuegbar,
    hat_varianten: !!a.hat_varianten,
    varianten_groessen: parseJSON(a.varianten_groessen),
    varianten_farben: parseJSON(a.varianten_farben),
    varianten_material: parseJSON(a.varianten_material),
    varianten_bestand: parseJSON(a.varianten_bestand),
    hat_preiskategorien: !!a.hat_preiskategorien,
    preis_kids_cent: a.preis_kids_cent || null,
    preis_erwachsene_cent: a.preis_erwachsene_cent || null,
    preis_kids_euro: a.preis_kids_cent ? a.preis_kids_cent / 100 : null,
    preis_erwachsene_euro: a.preis_erwachsene_cent ? a.preis_erwachsene_cent / 100 : null,
    groessen_kids: parseJSON(a.groessen_kids),
    groessen_erwachsene: parseJSON(a.groessen_erwachsene),
    kategorie_id: a.kat_kategorie_id || null,
    kategorie_name: a.kat_name || null,
    kategorie_icon: a.kat_icon || null,
    kategorie_farbe: a.kat_farbe || null,
    dojo_id: a.dojo_id,
    shop_aktiv: !!a.shop_aktiv
  };
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
            rechnung_erlaubt, stripe_publishable_key, feature_shop_premium
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
 * Nur Gruppen mit mindestens einem shop-aktiven Artikel für dieses Dojo
 * Join via a.kategorie_id (wie VerkaufKasse)
 */
router.get('/public/:dojoRef/kategorien', async (req, res) => {
  try {
    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(dojoId, 'a');

    // Alle Kategorien die direkte Artikel ODER Kinder-Kategorien mit Artikeln haben
    // parent_id = NULL → Hauptgruppe (wird als Header angezeigt)
    // parent_id = X    → Unter-Kategorie
    const [kategorien] = await db.promise().query(`
      SELECT ag.id, ag.name, ag.icon, ag.farbe AS farbe_hex, ag.sortierung, ag.parent_id,
             COUNT(a.artikel_id) AS artikel_anzahl
      FROM artikelgruppen ag
      LEFT JOIN artikel a ON a.kategorie_id = ag.id
        AND a.shop_aktiv = 1 AND a.aktiv = 1 AND ${dojoSql}
      WHERE ag.aktiv = 1
        AND (
          -- Eigene Artikel
          EXISTS (SELECT 1 FROM artikel a2 WHERE a2.kategorie_id = ag.id
                  AND a2.shop_aktiv = 1 AND a2.aktiv = 1 AND ${dojoSql.replace(/a\./g, 'a2.')})
          -- ODER Kinder-Kategorie hat Artikel (zeige Eltern-Gruppe als Header)
          OR EXISTS (SELECT 1 FROM artikelgruppen sub
                     JOIN artikel a3 ON a3.kategorie_id = sub.id
                     AND a3.shop_aktiv = 1 AND a3.aktiv = 1 AND ${dojoSql.replace(/a\./g, 'a3.')}
                     WHERE sub.parent_id = ag.id AND sub.aktiv = 1)
        )
      GROUP BY ag.id
      ORDER BY ag.parent_id IS NULL DESC, ag.sortierung, ag.name
    `, [...dojoParams, ...dojoParams, ...dojoParams]);

    res.json(kategorien);
  } catch (error) {
    logger.error('Kategorien Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

/**
 * GET /api/shop/public/:dojoRef/produkte
 * Query: ?gruppe=ID&search=text
 * Join via a.kategorie_id (wie VerkaufKasse) — alle Variant-Felder inklusive
 */
router.get('/public/:dojoRef/produkte', async (req, res) => {
  try {
    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { gruppe, search } = req.query;
    const { sql: dojoSql, params: dojoParams } = dojoWhere(dojoId, 'a');

    let query = `
      SELECT a.artikel_id, a.name, a.beschreibung, a.artikel_nummer,
             a.verkaufspreis_cent, a.bild_url,
             a.lagerbestand, a.lager_tracking, a.shop_aktiv, a.dojo_id,
             a.hat_varianten, a.varianten_groessen, a.varianten_farben,
             a.varianten_material, a.varianten_bestand,
             a.hat_preiskategorien, a.preis_kids_cent, a.preis_erwachsene_cent,
             a.groessen_kids, a.groessen_erwachsene,
             kat.id AS kat_kategorie_id, kat.name AS kat_name,
             kat.icon AS kat_icon, kat.farbe AS kat_farbe,
             kat.sortierung AS kat_sortierung
      FROM artikel a
      LEFT JOIN artikelgruppen kat ON a.kategorie_id = kat.id
      WHERE a.shop_aktiv = 1 AND a.aktiv = 1 AND ${dojoSql}
    `;
    const params = [...dojoParams];

    if (gruppe) {
      query += ` AND a.kategorie_id = ?`;
      params.push(parseInt(gruppe, 10));
    }
    if (search) {
      query += ` AND (a.name LIKE ? OR a.beschreibung LIKE ? OR a.artikel_nummer LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY kat.sortierung, a.name`;

    const [artikel] = await db.promise().query(query, params);
    res.json(artikel.map(normalizeArtikel));
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
    const { sql: dojoSql, params: dojoParams } = dojoWhere(dojoId, 'a');

    const [artikel] = await db.promise().query(`
      SELECT a.artikel_id, a.name, a.beschreibung, a.artikel_nummer,
             a.verkaufspreis_cent, a.bild_url,
             a.lagerbestand, a.lager_tracking, a.shop_aktiv, a.dojo_id,
             a.hat_varianten, a.varianten_groessen, a.varianten_farben,
             a.varianten_material, a.varianten_bestand,
             a.hat_preiskategorien, a.preis_kids_cent, a.preis_erwachsene_cent,
             a.groessen_kids, a.groessen_erwachsene,
             kat.id AS kat_kategorie_id, kat.name AS kat_name,
             kat.icon AS kat_icon, kat.farbe AS kat_farbe
      FROM artikel a
      LEFT JOIN artikelgruppen kat ON a.kategorie_id = kat.id
      WHERE a.artikel_id = ? AND a.shop_aktiv = 1 AND a.aktiv = 1 AND ${dojoSql}
    `, [req.params.id, ...dojoParams]);

    if (artikel.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    res.json(normalizeArtikel(artikel[0]));
  } catch (error) {
    logger.error('Produkt Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden des Produkts' });
  }
});

/**
 * POST /api/shop/public/:dojoRef/checkout
 * Guest-Checkout — kein Login nötig
 * Body: { positionen, lieferadresse, zahlungsart, kundennotiz }
 * positionen: [{ artikel_id, menge, optionen?, mitglied_id?, personalisierung? }]
 */
router.post('/public/:dojoRef/checkout', async (req, res) => {
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();

    const dojoId = resolveDojoRef(req.params.dojoRef);
    const { positionen, lieferadresse, zahlungsart, kundennotiz } = req.body;
    const { sql: dojoSql, params: dojoParams } = dojoWhere(dojoId, 'a');

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
    if (zahlungsartNorm === 'stripe' && !einstellungen.feature_shop_premium) {
      return res.status(403).json({ error: 'Kartenzahlung erfordert Shop-Premium' });
    }
    if (zahlungsartNorm === 'stripe' && !einstellungen.stripe_publishable_key) {
      return res.status(400).json({ error: 'Kartenzahlung momentan nicht verfügbar' });
    }

    // Artikel validieren und Preise berechnen
    let zwischensumme_cent = 0;
    const validatedPositionen = [];

    for (const pos of positionen) {
      const artikelId = pos.artikel_id || pos.produkt_id;
      if (!artikelId || !pos.menge || pos.menge < 1) {
        return res.status(400).json({ error: 'Ungültige Bestellposition' });
      }

      const [rows] = await connection.query(
        `SELECT a.artikel_id, a.name, a.verkaufspreis_cent, a.aktiv,
                a.lagerbestand, a.lager_tracking
         FROM artikel a
         WHERE a.artikel_id = ? AND a.shop_aktiv = 1 AND a.aktiv = 1 AND ${dojoSql}`,
        [artikelId, ...dojoParams]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: `Produkt ${artikelId} nicht gefunden oder nicht verfügbar` });
      }

      const artikel = rows[0];

      // Lagerbestand prüfen (nur wenn lager_tracking = 1)
      if (artikel.lager_tracking && artikel.lagerbestand < pos.menge) {
        return res.status(400).json({
          error: `Produkt "${artikel.name}" nicht in ausreichender Menge verfügbar`
        });
      }

      const einzelpreis_cent = artikel.verkaufspreis_cent;
      zwischensumme_cent += einzelpreis_cent * pos.menge;

      validatedPositionen.push({
        artikel_id: artikel.artikel_id,
        produkt_name: artikel.name,
        menge: pos.menge,
        einzelpreis_cent,
        gesamtpreis_cent: einzelpreis_cent * pos.menge,
        mitglied_id: pos.mitglied_id || null,
        personalisierung: pos.personalisierung ? JSON.stringify(pos.personalisierung) : null,
        optionen: pos.optionen ? JSON.stringify(pos.optionen) : null,
        produkt_variante: pos.optionen?.groesse || pos.optionen?.farbe || pos.optionen?.variante || null,
        lager_tracking: artikel.lager_tracking
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
        (bestellung_id, artikel_id, produkt_id, produkt_name, produkt_variante, menge,
         einzelpreis_cent, gesamtpreis_cent, mitglied_id, personalisierung, optionen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [bestellungId, pos.artikel_id, pos.artikel_id, pos.produkt_name,
          pos.produkt_variante, pos.menge, pos.einzelpreis_cent, pos.gesamtpreis_cent,
          pos.mitglied_id, pos.personalisierung, pos.optionen]);

      // Lagerbestand reduzieren (nur wenn lager_tracking = 1)
      if (pos.lager_tracking) {
        await connection.query(
          `UPDATE artikel SET lagerbestand = lagerbestand - ? WHERE artikel_id = ?`,
          [pos.menge, pos.artikel_id]
        );
      }
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
          await db.promise().query(
            'UPDATE shop_bestellungen SET stripe_payment_intent_id = ? WHERE id = ?',
            [paymentIntent.id, bestellungId]
          );
          client_secret = paymentIntent.client_secret;
        }
      } catch (stripeErr) {
        logger.error('Stripe PaymentIntent Fehler:', { error: stripeErr });
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
      client_secret
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
    const [positionen] = await db.promise().query(`
      SELECT bp.produkt_name, bp.produkt_variante, bp.menge,
             bp.einzelpreis_cent, bp.gesamtpreis_cent, bp.personalisierung, bp.optionen
      FROM shop_bestellpositionen bp
      WHERE bp.bestellung_id = (SELECT id FROM shop_bestellungen WHERE bestellnummer = ?)
    `, [req.params.bestellnummer]);

    bestellung.positionen = positionen.map(p => ({
      ...p,
      personalisierung: typeof p.personalisierung === 'string'
        ? JSON.parse(p.personalisierung || 'null') : p.personalisierung,
      optionen: typeof p.optionen === 'string'
        ? JSON.parse(p.optionen || 'null') : p.optionen
    }));

    res.json(bestellung);
  } catch (error) {
    logger.error('Bestellung laden Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellung' });
  }
});

/**
 * POST /api/shop/stripe/webhook
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
      await db.promise().query(
        `INSERT INTO shop_einstellungen (dojo_id, shop_aktiv, shop_name) VALUES (?, 0, ?)`,
        [secureDojoId, secureDojoId ? 'Dojo Shop' : 'TDA Shop']
      );
      const [newRows] = await db.promise().query(
        `SELECT * FROM shop_einstellungen WHERE ${sql}`, params
      );
      return res.json(newRows[0] || {});
    }

    const einstellungen = { ...rows[0] };
    if (einstellungen.stripe_secret_key) {
      einstellungen.stripe_secret_key_masked = '****' + einstellungen.stripe_secret_key.slice(-4);
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
    // Stripe-Keys nur bei Premium erlaubt
    const [premiumCheck] = await db.promise().query(
      `SELECT feature_shop_premium FROM shop_einstellungen WHERE ${sql}`, params
    );
    const isPremium = premiumCheck[0]?.feature_shop_premium || secureDojoId === null;

    if (stripe_secret_key && !stripe_secret_key.startsWith('****')) {
      if (!isPremium) return res.status(403).json({ error: 'Stripe erfordert Shop-Premium' });
      updateFields.stripe_secret_key = stripe_secret_key;
    }
    if (stripe_webhook_secret && !stripe_webhook_secret.startsWith('****')) {
      if (!isPremium) return res.status(403).json({ error: 'Stripe erfordert Shop-Premium' });
      updateFields.stripe_webhook_secret = stripe_webhook_secret;
    }
    if (stripe_publishable_key !== undefined) {
      if (!isPremium) return res.status(403).json({ error: 'Stripe erfordert Shop-Premium' });
    }

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
 * Alle Artikel des Dojos — mit shop_aktiv-Status
 */
router.get('/admin/produkte', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'a');

    const [artikel] = await db.promise().query(`
      SELECT a.artikel_id AS id, a.artikel_id, a.name, a.artikel_nummer,
             a.beschreibung, a.verkaufspreis_cent, a.bild_url,
             a.lagerbestand, a.lager_tracking, a.aktiv, a.shop_aktiv,
             a.hat_varianten, a.varianten_groessen, a.varianten_farben,
             a.hat_preiskategorien, a.preis_kids_cent, a.preis_erwachsene_cent,
             a.sichtbar_kasse,
             ag.id AS kategorie_id, ag.name AS kategorie_name,
             ag.icon AS kategorie_icon, ag.farbe AS kategorie_farbe
      FROM artikel a
      LEFT JOIN artikelgruppen ag ON a.kategorie_id = ag.id
      WHERE ${dojoSql}
      ORDER BY a.shop_aktiv DESC, ag.sortierung, a.name
    `, dojoParams);

    res.json(artikel.map(a => ({
      ...a,
      preis: a.verkaufspreis_cent / 100,
      varianten_groessen: parseJSON(a.varianten_groessen),
      varianten_farben: parseJSON(a.varianten_farben)
    })));
  } catch (error) {
    logger.error('Admin-Produkte Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
  }
});

/**
 * POST /api/shop/admin/produkte
 * Neues Produkt anlegen — erstellt einen Artikel mit shop_aktiv=1
 * Nur für das eigene Dojo (getSecureDojoId schützt automatisch)
 */
router.post('/admin/produkte', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    if (!secureDojoId) {
      return res.status(400).json({ error: 'Dojo-ID fehlt — Super-Admin muss ?dojo_id=X angeben' });
    }

    const {
      name, artikel_nummer, beschreibung, preis,
      artikelgruppe_id, bild_url, lager_tracking, lagerbestand, sichtbar_kasse
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
    if (!preis && preis !== 0) return res.status(400).json({ error: 'Preis ist erforderlich' });

    const verkaufspreis_cent = Math.round(parseFloat(preis) * 100);
    if (isNaN(verkaufspreis_cent)) return res.status(400).json({ error: 'Ungültiger Preis' });

    // kategorie_id ist NOT NULL in artikel — Artikelgruppe als Fallback
    const kategorieId = artikelgruppe_id || 1;

    const [result] = await db.promise().query(`
      INSERT INTO artikel
      (dojo_id, kategorie_id, artikelgruppe_id, name, artikel_nummer, beschreibung,
       verkaufspreis_cent, bild_url, lager_tracking, lagerbestand,
       aktiv, shop_aktiv, sichtbar_kasse, mwst_prozent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 19.00)
    `, [
      secureDojoId,
      kategorieId,
      artikelgruppe_id || null,
      name,
      artikel_nummer || null,
      beschreibung || null,
      verkaufspreis_cent,
      bild_url || null,
      lager_tracking ? 1 : 0,
      lagerbestand !== undefined ? parseInt(lagerbestand, 10) : 0,
      sichtbar_kasse !== false ? 1 : 0
    ]);

    res.status(201).json({ success: true, id: result.insertId, artikel_id: result.insertId });
  } catch (error) {
    logger.error('Produkt erstellen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Erstellen des Produkts' });
  }
});

/**
 * PUT /api/shop/admin/produkte/:id
 * Produkt bearbeiten
 */
router.put('/admin/produkte/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'a');

    // Zugehörigkeit prüfen
    const [check] = await db.promise().query(
      `SELECT artikel_id FROM artikel a WHERE a.artikel_id = ? AND ${dojoSql}`,
      [req.params.id, ...dojoParams]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Produkt nicht gefunden' });

    const {
      name, artikel_nummer, beschreibung, preis,
      artikelgruppe_id, bild_url, lager_tracking, lagerbestand, sichtbar_kasse
    } = req.body;

    const verkaufspreis_cent = Math.round(parseFloat(preis) * 100);
    const kategorieId = artikelgruppe_id || 1;

    await db.promise().query(`
      UPDATE artikel SET
        name = ?, artikel_nummer = ?, beschreibung = ?,
        verkaufspreis_cent = ?, artikelgruppe_id = ?, kategorie_id = ?,
        bild_url = ?, lager_tracking = ?, lagerbestand = ?, sichtbar_kasse = ?
      WHERE artikel_id = ?
    `, [
      name,
      artikel_nummer || null,
      beschreibung || null,
      verkaufspreis_cent,
      artikelgruppe_id || null,
      kategorieId,
      bild_url || null,
      lager_tracking ? 1 : 0,
      lagerbestand !== undefined ? parseInt(lagerbestand, 10) : 0,
      sichtbar_kasse !== false ? 1 : 0,
      req.params.id
    ]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Produkt update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Produkts' });
  }
});

/**
 * DELETE /api/shop/admin/produkte/:id
 * Produkt aus dem Shop entfernen (setzt shop_aktiv=0, löscht nicht aus Artikelverwaltung)
 */
router.delete('/admin/produkte/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'a');

    await db.promise().query(
      `UPDATE artikel a SET a.shop_aktiv = 0 WHERE a.artikel_id = ? AND ${dojoSql}`,
      [req.params.id, ...dojoParams]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Produkt aus Shop entfernen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Entfernen aus dem Shop' });
  }
});

/**
 * PATCH /api/shop/admin/produkte/:id/shop-aktiv
 * Schaltet einen Artikel im Shop an/aus
 */
router.patch('/admin/produkte/:id/shop-aktiv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'a');
    const { shop_aktiv } = req.body;

    if (shop_aktiv === undefined) {
      return res.status(400).json({ error: 'shop_aktiv fehlt' });
    }

    // Prüfen ob Artikel dem Dojo gehört
    const [check] = await db.promise().query(
      `SELECT artikel_id FROM artikel a WHERE a.artikel_id = ? AND ${dojoSql}`,
      [req.params.id, ...dojoParams]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    await db.promise().query(
      `UPDATE artikel SET shop_aktiv = ? WHERE artikel_id = ?`,
      [shop_aktiv ? 1 : 0, req.params.id]
    );

    res.json({ success: true, shop_aktiv: !!shop_aktiv });
  } catch (error) {
    logger.error('Shop-Aktiv Toggle Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

/**
 * GET /api/shop/admin/kategorien
 * Artikelgruppen des Dojos — für Kategorien-Übersicht im Shop-Admin
 */
router.get('/admin/kategorien', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'a');

    // Zeige alle Gruppen die vom Dojo tatsächlich genutzt werden (via kategorie_id)
    // + Gruppen die dem Dojo direkt gehören
    const [kategorien] = await db.promise().query(`
      SELECT ag.id, ag.name, ag.icon, ag.farbe, ag.parent_id,
             ag.sortierung, ag.aktiv, p.name AS parent_name,
             COUNT(DISTINCT CASE WHEN a.aktiv = 1 THEN a.artikel_id END) AS artikel_anzahl,
             COUNT(DISTINCT CASE WHEN a.shop_aktiv = 1 AND a.aktiv = 1 THEN a.artikel_id END) AS shop_artikel_anzahl,
             COUNT(DISTINCT CASE WHEN a.shop_aktiv = 1 AND a.aktiv = 1 THEN a.artikel_id END) AS produkt_anzahl
      FROM artikelgruppen ag
      LEFT JOIN artikelgruppen p ON ag.parent_id = p.id
      LEFT JOIN artikel a ON a.kategorie_id = ag.id AND ${dojoSql}
      WHERE ag.aktiv = 1
        AND (
          EXISTS (SELECT 1 FROM artikel a2 WHERE a2.kategorie_id = ag.id AND ${dojoSql.replace(/a\./g, 'a2.')})
          OR EXISTS (SELECT 1 FROM artikelgruppen sub
                     JOIN artikel a3 ON a3.kategorie_id = sub.id AND ${dojoSql.replace(/a\./g, 'a3.')}
                     WHERE sub.parent_id = ag.id)
        )
      GROUP BY ag.id
      ORDER BY ag.parent_id IS NULL DESC, ag.sortierung, ag.name
    `, [...dojoParams, ...dojoParams, ...dojoParams]);

    res.json(kategorien);
  } catch (error) {
    logger.error('Admin-Kategorien Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

/**
 * POST /api/shop/admin/kategorien
 * Neue Artikelgruppe (Kategorie) anlegen
 */
router.post('/admin/kategorien', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    if (!secureDojoId) {
      return res.status(400).json({ error: 'Dojo-ID fehlt — Super-Admin muss ?dojo_id=X angeben' });
    }

    const { name, beschreibung, icon, farbe, sortierung, parent_id, aktiv } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
    }

    const [result] = await db.promise().query(`
      INSERT INTO artikelgruppen (dojo_id, name, beschreibung, icon, farbe, sortierung, parent_id, aktiv)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      secureDojoId, name,
      beschreibung || null, icon || null, farbe || '#3B82F6',
      parseInt(sortierung) || 0, parent_id || null, aktiv !== false ? 1 : 0
    ]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Kategorie erstellen Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

/**
 * PUT /api/shop/admin/kategorien/:id
 * Kategorie bearbeiten
 */
router.put('/admin/kategorien/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'ag');

    // Zugehörigkeit prüfen
    const [check] = await db.promise().query(
      `SELECT id FROM artikelgruppen ag WHERE ag.id = ? AND ${dojoSql}`,
      [req.params.id, ...dojoParams]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    const { name, beschreibung, icon, farbe, sortierung, parent_id, aktiv } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name ist ein Pflichtfeld' });
    }

    await db.promise().query(`
      UPDATE artikelgruppen SET
        name = ?, beschreibung = ?, icon = ?, farbe = ?,
        sortierung = ?, parent_id = ?, aktiv = ?
      WHERE id = ?
    `, [
      name, beschreibung || null, icon || null, farbe || '#3B82F6',
      parseInt(sortierung) || 0, parent_id || null, aktiv !== false ? 1 : 0,
      req.params.id
    ]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Kategorie update Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
  }
});

/**
 * DELETE /api/shop/admin/kategorien/:id
 * Kategorie deaktivieren (soft delete — aktiv=0)
 */
router.delete('/admin/kategorien/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId, 'ag');

    // Zugehörigkeit prüfen
    const [check] = await db.promise().query(
      `SELECT id FROM artikelgruppen ag WHERE ag.id = ? AND ${dojoSql}`,
      [req.params.id, ...dojoParams]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    await db.promise().query(
      `UPDATE artikelgruppen SET aktiv = 0 WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Kategorie deaktivieren Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Deaktivieren der Kategorie' });
  }
});

/**
 * GET /api/shop/admin/bestellungen
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
      SELECT bp.*, a.name AS artikel_name_aktuell, a.artikel_nummer
      FROM shop_bestellpositionen bp
      LEFT JOIN artikel a ON bp.artikel_id = a.artikel_id
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
 */
router.get('/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { sql: dojoSql, params: dojoParams } = dojoWhere(secureDojoId);
    const { sql: artikelDojoSql, params: artikelDojoParams } = dojoWhere(secureDojoId, 'a');

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
      WHERE b.${dojoSql}
    `, dojoParams);

    const [topProdukte] = await db.promise().query(`
      SELECT bp.produkt_name, SUM(bp.menge) AS verkauft, SUM(bp.gesamtpreis_cent) AS umsatz_cent
      FROM shop_bestellpositionen bp
      JOIN shop_bestellungen b ON bp.bestellung_id = b.id
      WHERE b.${dojoSql} AND b.bestellt_am >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY bp.artikel_id, bp.produkt_name
      ORDER BY verkauft DESC
      LIMIT 5
    `, dojoParams);

    // Shop-Statistik: Aktive Produkte im Shop
    const [shopStats] = await db.promise().query(`
      SELECT COUNT(*) AS gesamt_artikel,
             SUM(CASE WHEN shop_aktiv = 1 THEN 1 ELSE 0 END) AS shop_aktiv_artikel
      FROM artikel a
      WHERE ${artikelDojoSql}
    `, artikelDojoParams);

    res.json({
      stats: stats[0],
      top_produkte: topProdukte,
      artikel_stats: shopStats[0]
    });
  } catch (error) {
    logger.error('Shop-Dashboard Fehler:', { error });
    res.status(500).json({ error: 'Fehler beim Laden des Dashboards' });
  }
});

module.exports = router;
