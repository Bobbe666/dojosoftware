const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Admin-Prüfung Middleware
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin-Berechtigung erforderlich' });
  }
};

// ==================== ÖFFENTLICHE ROUTES ====================

// Alle Kategorien abrufen (mit Hierarchie)
router.get('/kategorien', async (req, res) => {
  try {
    const [kategorien] = await db.promise().query(`
      SELECT k.*,
             p.name as parent_name,
             (SELECT COUNT(*) FROM shop_produkte WHERE kategorie_id = k.id AND aktiv = TRUE) as produkt_anzahl
      FROM shop_kategorien k
      LEFT JOIN shop_kategorien p ON k.parent_id = p.id
      WHERE k.aktiv = TRUE
      ORDER BY k.parent_id IS NULL DESC, k.sortierung, k.name
    `);

    // Hierarchie aufbauen
    const parentKategorien = kategorien.filter(k => !k.parent_id);
    const result = parentKategorien.map(parent => ({
      ...parent,
      children: kategorien.filter(k => k.parent_id === parent.id)
    }));

    // Kategorien ohne Parent hinzufügen
    const ohneParent = kategorien.filter(k => k.parent_id && !parentKategorien.find(p => p.id === k.parent_id));

    res.json([...result, ...ohneParent]);
  } catch (error) {
    logger.error('Fehler beim Laden der Kategorien:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// Alle Produkte abrufen
router.get('/produkte', async (req, res) => {
  try {
    const { kategorie, featured, search } = req.query;

    let query = `
      SELECT p.*, k.name as kategorie_name, k.slug as kategorie_slug,
             pk.name as parent_kategorie_name, pk.id as parent_kategorie_id
      FROM shop_produkte p
      JOIN shop_kategorien k ON p.kategorie_id = k.id
      LEFT JOIN shop_kategorien pk ON k.parent_id = pk.id
      WHERE p.aktiv = TRUE
    `;
    const params = [];

    if (kategorie) {
      query += ` AND (k.slug = ? OR k.parent_id = (SELECT id FROM shop_kategorien WHERE slug = ?))`;
      params.push(kategorie, kategorie);
    }

    if (featured === 'true') {
      query += ` AND p.featured = TRUE`;
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.beschreibung LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.featured DESC, k.sortierung, p.name`;

    const [produkte] = await db.promise().query(query, params);

    // JSON-Felder parsen
    const result = produkte.map(p => ({
      ...p,
      details: typeof p.details === 'string' ? JSON.parse(p.details) : p.details,
      optionen: typeof p.optionen === 'string' ? JSON.parse(p.optionen) : p.optionen
    }));

    res.json(result);
  } catch (error) {
    logger.error('Fehler beim Laden der Produkte:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
  }
});

// Einzelnes Produkt abrufen
router.get('/produkte/:id', async (req, res) => {
  try {
    const [produkte] = await db.promise().query(`
      SELECT p.*, k.name as kategorie_name, k.slug as kategorie_slug,
             pk.name as parent_kategorie_name, pk.id as parent_kategorie_id
      FROM shop_produkte p
      JOIN shop_kategorien k ON p.kategorie_id = k.id
      LEFT JOIN shop_kategorien pk ON k.parent_id = pk.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (produkte.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    const produkt = produkte[0];
    produkt.details = typeof produkt.details === 'string' ? JSON.parse(produkt.details) : produkt.details;
    produkt.optionen = typeof produkt.optionen === 'string' ? JSON.parse(produkt.optionen) : produkt.optionen;

    res.json(produkt);
  } catch (error) {
    logger.error('Fehler beim Laden des Produkts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden des Produkts' });
  }
});

// ==================== GESCHÜTZTE ROUTES (eingeloggte User) ====================

// Bestellung erstellen
router.post('/bestellungen', authenticateToken, async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const { positionen, lieferadresse, rechnungsadresse, anmerkungen, zahlungsart, stripe_payment_intent_id, bezahlt } = req.body;
    const userId = req.user.id;
    const dojoId = req.user.dojo_id;

    if (!positionen || positionen.length === 0) {
      return res.status(400).json({ error: 'Keine Produkte in der Bestellung' });
    }

    // Bestellnummer generieren
    const bestellnummer = 'TDA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Gesamtsumme berechnen (in Cent)
    let zwischensumme = 0;
    for (const pos of positionen) {
      const [produkt] = await connection.query('SELECT preis FROM shop_produkte WHERE id = ?', [pos.produkt_id]);
      if (produkt.length > 0) {
        zwischensumme += produkt[0].preis * pos.menge * 100; // in Cent
      }
    }

    const versandkosten = zwischensumme >= 5000 ? 0 : 495; // Frei ab 50€, sonst 4,95€
    const gesamtbetrag = zwischensumme + versandkosten;

    // Kundennamen aus lieferadresse
    const kundeName = lieferadresse ? `${lieferadresse.vorname || ''} ${lieferadresse.nachname || ''}`.trim() : 'Unbekannt';
    const kundeEmail = rechnungsadresse?.email || '';

    // Bestellung anlegen (mit korrekter Tabellenstruktur)
    const [bestellung] = await connection.query(`
      INSERT INTO shop_bestellungen
      (bestellnummer, verbandsmitgliedschaft_id, kunde_name, kunde_email,
       lieferadresse_strasse, lieferadresse_plz, lieferadresse_ort, lieferadresse_land,
       zwischensumme_cent, versandkosten_cent, gesamtbetrag_cent,
       status, zahlungsart, bezahlt, bezahlt_am, stripe_payment_intent_id, kundennotiz)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?, ?, ?, ?)
    `, [
      bestellnummer,
      userId, // verbandsmitgliedschaft_id
      kundeName,
      kundeEmail,
      lieferadresse?.strasse || '',
      lieferadresse?.plz || '',
      lieferadresse?.ort || '',
      lieferadresse?.land || 'Deutschland',
      zwischensumme,
      versandkosten,
      gesamtbetrag,
      zahlungsart || 'rechnung',
      bezahlt ? 1 : 0,
      bezahlt ? new Date() : null,
      stripe_payment_intent_id || null,
      anmerkungen || null
    ]);

    const bestellungId = bestellung.insertId;

    // Positionen anlegen
    for (const pos of positionen) {
      const [produkt] = await connection.query('SELECT preis, name FROM shop_produkte WHERE id = ?', [pos.produkt_id]);
      if (produkt.length > 0) {
        await connection.query(`
          INSERT INTO shop_bestellpositionen
          (bestellung_id, produkt_id, menge, einzelpreis, optionen)
          VALUES (?, ?, ?, ?, ?)
        `, [bestellungId, pos.produkt_id, pos.menge, produkt[0].preis, JSON.stringify(pos.optionen || {})]);
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      bestellnummer,
      bestellung_id: bestellungId,
      gesamtsumme: gesamtbetrag / 100 // zurück in Euro für Frontend
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Fehler beim Erstellen der Bestellung:', { error: error });
    res.status(500).json({ error: 'Fehler beim Erstellen der Bestellung', details: error.message });
  } finally {
    connection.release();
  }
});

// Eigene Bestellungen abrufen
router.get('/bestellungen/meine', authenticateToken, async (req, res) => {
  try {
    const [bestellungen] = await db.promise().query(`
      SELECT b.*,
             (SELECT COUNT(*) FROM shop_bestellpositionen WHERE bestellung_id = b.id) as anzahl_positionen
      FROM shop_bestellungen b
      WHERE b.verbandsmitgliedschaft_id = ?
      ORDER BY b.bestellt_am DESC
    `, [req.user.id]);

    res.json(bestellungen);
  } catch (error) {
    logger.error('Fehler beim Laden der Bestellungen:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
  }
});

// Einzelne Bestellung mit Details
router.get('/bestellungen/:id', authenticateToken, async (req, res) => {
  try {
    const [bestellungen] = await db.promise().query(`
      SELECT b.* FROM shop_bestellungen b
      WHERE b.id = ? AND (b.user_id = ? OR ? = TRUE)
    `, [req.params.id, req.user.id, req.user.role === 'admin']);

    if (bestellungen.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    const bestellung = bestellungen[0];

    // Positionen laden
    const [positionen] = await db.promise().query(`
      SELECT bp.*, p.name as produkt_name, p.sku
      FROM shop_bestellpositionen bp
      JOIN shop_produkte p ON bp.produkt_id = p.id
      WHERE bp.bestellung_id = ?
    `, [req.params.id]);

    bestellung.positionen = positionen.map(p => ({
      ...p,
      optionen: typeof p.optionen === 'string' ? JSON.parse(p.optionen) : p.optionen
    }));

    bestellung.lieferadresse = typeof bestellung.lieferadresse === 'string' ? JSON.parse(bestellung.lieferadresse) : bestellung.lieferadresse;
    bestellung.rechnungsadresse = typeof bestellung.rechnungsadresse === 'string' ? JSON.parse(bestellung.rechnungsadresse) : bestellung.rechnungsadresse;

    res.json(bestellung);
  } catch (error) {
    logger.error('Fehler beim Laden der Bestellung:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellung' });
  }
});

// ==================== ADMIN ROUTES ====================

// Alle Bestellungen (Admin)
router.get('/admin/bestellungen', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, dojo_id } = req.query;

    let query = `
      SELECT b.*, u.name as user_name, u.email as user_email, d.name as dojo_name,
             (SELECT COUNT(*) FROM shop_bestellpositionen WHERE bestellung_id = b.id) as anzahl_positionen
      FROM shop_bestellungen b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN dojos d ON b.dojo_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (dojo_id) {
      query += ` AND b.dojo_id = ?`;
      params.push(dojo_id);
    }

    query += ` ORDER BY b.erstellt_am DESC`;

    const [bestellungen] = await db.promise().query(query, params);
    res.json(bestellungen);
  } catch (error) {
    logger.error('Fehler beim Laden der Bestellungen:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
  }
});

// Bestellstatus aktualisieren (Admin)
router.patch('/admin/bestellungen/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['neu', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert'];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    await db.promise().query('UPDATE shop_bestellungen SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Status:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
  }
});

// Alle Produkte (Admin - inkl. inaktive)
router.get('/admin/produkte', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [produkte] = await db.promise().query(`
      SELECT p.*, k.name as kategorie_name, k.slug as kategorie_slug,
             pk.name as parent_kategorie_name
      FROM shop_produkte p
      JOIN shop_kategorien k ON p.kategorie_id = k.id
      LEFT JOIN shop_kategorien pk ON k.parent_id = pk.id
      ORDER BY k.sortierung, p.name
    `);

    const result = produkte.map(p => ({
      ...p,
      details: typeof p.details === 'string' ? JSON.parse(p.details) : p.details,
      optionen: typeof p.optionen === 'string' ? JSON.parse(p.optionen) : p.optionen
    }));

    res.json(result);
  } catch (error) {
    logger.error('Fehler beim Laden der Produkte:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
  }
});

// Produkt erstellen (Admin)
router.post('/admin/produkte', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { kategorie_id, sku, name, beschreibung, preis, details, optionen, lieferzeit, featured, aktiv } = req.body;

    const [result] = await db.promise().query(`
      INSERT INTO shop_produkte
      (kategorie_id, sku, name, beschreibung, preis, details, optionen, lieferzeit, featured, aktiv)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [kategorie_id, sku, name, beschreibung, preis,
        JSON.stringify(details || {}), JSON.stringify(optionen || {}),
        lieferzeit, featured || false, aktiv !== false]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Fehler beim Erstellen des Produkts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Erstellen des Produkts' });
  }
});

// Produkt aktualisieren (Admin)
router.put('/admin/produkte/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { kategorie_id, sku, name, beschreibung, preis, details, optionen, lieferzeit, featured, aktiv } = req.body;

    await db.promise().query(`
      UPDATE shop_produkte SET
        kategorie_id = ?, sku = ?, name = ?, beschreibung = ?, preis = ?,
        details = ?, optionen = ?, lieferzeit = ?, featured = ?, aktiv = ?
      WHERE id = ?
    `, [kategorie_id, sku, name, beschreibung, preis,
        JSON.stringify(details || {}), JSON.stringify(optionen || {}),
        lieferzeit, featured || false, aktiv !== false, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren des Produkts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Produkts' });
  }
});

// Produkt löschen (Admin)
router.delete('/admin/produkte/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.promise().query('UPDATE shop_produkte SET aktiv = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Löschen des Produkts:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen des Produkts' });
  }
});

// Alle Kategorien (Admin - inkl. inaktive)
router.get('/admin/kategorien', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [kategorien] = await db.promise().query(`
      SELECT k.*, p.name as parent_name,
             (SELECT COUNT(*) FROM shop_produkte WHERE kategorie_id = k.id) as produkt_anzahl
      FROM shop_kategorien k
      LEFT JOIN shop_kategorien p ON k.parent_id = p.id
      ORDER BY k.parent_id IS NULL DESC, k.sortierung, k.name
    `);
    res.json(kategorien);
  } catch (error) {
    logger.error('Fehler beim Laden der Kategorien:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

// Kategorie erstellen (Admin)
router.post('/admin/kategorien', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv } = req.body;

    const [result] = await db.promise().query(`
      INSERT INTO shop_kategorien
      (name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, slug, beschreibung, icon, farbe || '#3B82F6', sortierung || 0, parent_id, aktiv !== false]);

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    logger.error('Fehler beim Erstellen der Kategorie:', { error: error });
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

// Kategorie aktualisieren (Admin)
router.put('/admin/kategorien/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv } = req.body;

    await db.promise().query(`
      UPDATE shop_kategorien SET
        name = ?, slug = ?, beschreibung = ?, icon = ?, farbe = ?,
        sortierung = ?, parent_id = ?, aktiv = ?
      WHERE id = ?
    `, [name, slug, beschreibung, icon, farbe, sortierung, parent_id, aktiv !== false, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Kategorie:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
  }
});

module.exports = router;
