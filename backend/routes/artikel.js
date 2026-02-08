// =====================================================================================
// ARTIKEL-VERWALTUNG API-ROUTES - DOJOSOFTWARE VERKAUFSSYSTEM
// =====================================================================================
// Vollständige CRUD-Operationen für Artikel mit Lagerbestand-Tracking
// Deutsche rechtliche Grundlagen beachtet
// =====================================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureAccess');
// const multer = require('multer'); // TODO: Später für Bild-Uploads hinzufügen
// const path = require('path');
// const fs = require('fs');

// Logger
const logger = {
  info: (...args) => console.log('[Artikel]', ...args),
  error: (...args) => console.error('[Artikel ERROR]', ...args),
  debug: (...args) => console.log('[Artikel DEBUG]', ...args),
  warn: (...args) => console.warn('[Artikel WARN]', ...args)
};

// =====================================================================================
// FEATURE PROTECTION: Verkauf & Lagerhaltung
// =====================================================================================
// Alle Artikel-Routes erfordern das 'verkauf' Feature (ab Professional Plan)
router.use(authenticateToken);
router.use(requireFeature('verkauf'));

// =====================================================================================
// MIDDLEWARE & KONFIGURATION
// =====================================================================================

// TODO: Multer für Bild-Uploads implementieren
// const upload = null; // Placeholder

// =====================================================================================
// HILFSFUNKTIONEN
// =====================================================================================

const formatArtikel = (artikel) => ({
  ...artikel,
  verkaufspreis_euro: artikel.verkaufspreis_cent / 100,
  einkaufspreis_euro: artikel.einkaufspreis_cent / 100,
  zusatzkosten_euro: artikel.zusatzkosten_cent ? artikel.zusatzkosten_cent / 100 : 0,
  // Handelskalkulation - Bezugskalkulation (Einzelpreis)
  listeneinkaufspreis_euro: artikel.listeneinkaufspreis_cent ? artikel.listeneinkaufspreis_cent / 100 : 0,
  bezugskosten_euro: artikel.bezugskosten_cent ? artikel.bezugskosten_cent / 100 : 0,
  // Handelskalkulation - Größenabhängig (Kids)
  listeneinkaufspreis_kids_euro: artikel.listeneinkaufspreis_kids_cent ? artikel.listeneinkaufspreis_kids_cent / 100 : 0,
  bezugskosten_kids_euro: artikel.bezugskosten_kids_cent ? artikel.bezugskosten_kids_cent / 100 : 0,
  // Handelskalkulation - Größenabhängig (Erwachsene)
  listeneinkaufspreis_erwachsene_euro: artikel.listeneinkaufspreis_erwachsene_cent ? artikel.listeneinkaufspreis_erwachsene_cent / 100 : 0,
  bezugskosten_erwachsene_euro: artikel.bezugskosten_erwachsene_cent ? artikel.bezugskosten_erwachsene_cent / 100 : 0,
  // Varianten-Preise (VK)
  preis_kids_euro: artikel.preis_kids_cent ? artikel.preis_kids_cent / 100 : null,
  preis_erwachsene_euro: artikel.preis_erwachsene_cent ? artikel.preis_erwachsene_cent / 100 : null,
  // JSON-Felder parsen
  varianten_groessen: artikel.varianten_groessen ? (typeof artikel.varianten_groessen === 'string' ? JSON.parse(artikel.varianten_groessen) : artikel.varianten_groessen) : [],
  varianten_farben: artikel.varianten_farben ? (typeof artikel.varianten_farben === 'string' ? JSON.parse(artikel.varianten_farben) : artikel.varianten_farben) : [],
  varianten_material: artikel.varianten_material ? (typeof artikel.varianten_material === 'string' ? JSON.parse(artikel.varianten_material) : artikel.varianten_material) : [],
  varianten_bestand: artikel.varianten_bestand ? (typeof artikel.varianten_bestand === 'string' ? JSON.parse(artikel.varianten_bestand) : artikel.varianten_bestand) : {},
  groessen_kids: artikel.groessen_kids ? (typeof artikel.groessen_kids === 'string' ? JSON.parse(artikel.groessen_kids) : artikel.groessen_kids) : ['100', '110', '120', '130', '140', '150'],
  groessen_erwachsene: artikel.groessen_erwachsene ? (typeof artikel.groessen_erwachsene === 'string' ? JSON.parse(artikel.groessen_erwachsene) : artikel.groessen_erwachsene) : ['160', '170', '180', '190', '200', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  lager_status: artikel.lagerbestand <= artikel.mindestbestand ?
    (artikel.lagerbestand === 0 ? 'ausverkauft' : 'nachbestellen') : 'verfuegbar'
});

const createLagerbewegung = (artikel_id, bewegungsart, menge, alter_bestand, neuer_bestand, grund, benutz_id = null) => {
  const query = `
    INSERT INTO lager_bewegungen 
    (artikel_id, bewegungsart, menge, alter_bestand, neuer_bestand, grund, durchgefuehrt_von) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  return new Promise((resolve, reject) => {
    db.query(query, [artikel_id, bewegungsart, menge, alter_bestand, neuer_bestand, grund, benutz_id], 
      (error, results) => {
        if (error) reject(error);
        else resolve(results);
      });
  });
};

// =====================================================================================
// KATEGORIEN
// =====================================================================================

// GET /api/artikel/kategorien - Alle Kategorien abrufen
router.get('/kategorien', (req, res) => {
  // Super-Admin Check (darf alles sehen)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin darf ohne dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  const dojoId = req.tenant?.dojo_id;

  // Datenbank verwenden - Super-Admin sieht alle
  let query, params;
  if (isSuperAdmin && !dojoId) {
    query = `
      SELECT
        kategorie_id,
        name,
        beschreibung,
        farbe_hex,
        icon,
        aktiv,
        reihenfolge,
        dojo_id,
        (SELECT COUNT(*) FROM artikel WHERE kategorie_id = ak.kategorie_id AND aktiv = TRUE) as anzahl_artikel
      FROM artikel_kategorien ak
      WHERE aktiv = TRUE
      ORDER BY reihenfolge ASC, name ASC
    `;
    params = [];
  } else {
    query = `
      SELECT
        kategorie_id,
        name,
        beschreibung,
        farbe_hex,
        icon,
        aktiv,
        reihenfolge,
        (SELECT COUNT(*) FROM artikel WHERE kategorie_id = ak.kategorie_id AND aktiv = TRUE AND dojo_id = ?) as anzahl_artikel
      FROM artikel_kategorien ak
      WHERE aktiv = TRUE AND dojo_id = ?
      ORDER BY reihenfolge ASC, name ASC
    `;
    params = [dojoId, dojoId];
  }

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Kategorien:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Abrufen der Kategorien' });
    }
    res.json({ success: true, data: results });
  });
});

// POST /api/artikel/kategorien - Neue Kategorie erstellen
router.post('/kategorien', (req, res) => {
  // Super-Admin Check (darf alles)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }

  const { name, beschreibung, farbe_hex, icon, reihenfolge } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }

  const query = `
    INSERT INTO artikel_kategorien (name, beschreibung, farbe_hex, icon, reihenfolge, dojo_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [name, beschreibung, farbe_hex || '#3B82F6', icon || 'package', reihenfolge || 0, dojoId], 
    (error, results) => {
      if (error) {
        logger.error('Fehler beim Erstellen der Kategorie:', { error: error });
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Kategorie-Name bereits vorhanden' });
        }
        return res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
      }
      res.json({ 
        success: true, 
        kategorie_id: results.insertId,
        message: 'Kategorie erfolgreich erstellt' 
      });
    });
});

// =====================================================================================
// ARTIKEL-CRUD
// =====================================================================================

// GET /api/artikel - Alle Artikel abrufen (mit optionaler Kategorien-Filterung)
router.get('/', (req, res) => {
  // Super-Admin Check (darf alles sehen)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Hole dojo_id aus verschiedenen Quellen (Tenant, Query-Parameter, User-Token)
  const dojoId = req.tenant?.dojo_id || req.query.dojo_id || req.dojo_id || req.user?.dojo_id;

  // Tenant check (Super-Admin darf ohne dojo_id)
  if (!isSuperAdmin && !dojoId) {
    return res.status(403).json({ error: 'No tenant' });
  }

  const { kategorie_id, aktiv, sichtbar_kasse } = req.query;

  // Datenbank verwenden - Super-Admin sieht alle
  let query, params;

  if (isSuperAdmin && !dojoId) {
    query = `
      SELECT
        a.*,
        kat.name as kategorie_name,
        kat.farbe as kategorie_farbe,
        kat.icon as kategorie_icon,
        ag.name as artikelgruppe_name,
        ag.farbe as artikelgruppe_farbe,
        ag.icon as artikelgruppe_icon,
        CASE
          WHEN ag.parent_id IS NULL THEN ag.name
          ELSE CONCAT(pag.name, ' → ', ag.name)
        END AS artikelgruppe_vollstaendig
      FROM artikel a
      LEFT JOIN artikelgruppen kat ON a.kategorie_id = kat.id
      LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
      LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
      WHERE 1=1
    `;
    params = [];
  } else {
    query = `
      SELECT
        a.*,
        kat.name as kategorie_name,
        kat.farbe as kategorie_farbe,
        kat.icon as kategorie_icon,
        ag.name as artikelgruppe_name,
        ag.farbe as artikelgruppe_farbe,
        ag.icon as artikelgruppe_icon,
        CASE
          WHEN ag.parent_id IS NULL THEN ag.name
          ELSE CONCAT(pag.name, ' → ', ag.name)
        END AS artikelgruppe_vollstaendig
      FROM artikel a
      LEFT JOIN artikelgruppen kat ON a.kategorie_id = kat.id
      LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
      LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
      WHERE a.dojo_id = ?
    `;
    params = [dojoId];
  }

  if (kategorie_id) {
    query += ' AND a.kategorie_id = ?';
    params.push(kategorie_id);
  }

  if (aktiv !== undefined) {
    query += ' AND a.aktiv = ?';
    params.push(aktiv === 'true');
  }

  if (sichtbar_kasse !== undefined) {
    query += ' AND a.sichtbar_kasse = ?';
    params.push(sichtbar_kasse === 'true');
  }

  query += ' ORDER BY kat.sortierung ASC, a.name ASC';

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Artikel:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Abrufen der Artikel' });
    }

    const formattedResults = results.map(formatArtikel);
    res.json({ success: true, data: formattedResults });
  });
});

// GET /api/artikel/kasse - Artikel für Kassensystem optimiert
router.get('/kasse', (req, res) => {
  // Tenant check - unterstütze sowohl Subdomain als auch Hauptdomain
  const dojoId = req.tenant?.dojo_id || req.query.dojo_id || req.user?.dojo_id;
  const showAll = !dojoId || dojoId === 'all' || dojoId === 'null';

  let query;
  let params;

  // Artikel haben kein dojo_id - alle Artikel anzeigen
  query = `
    SELECT
      a.artikel_id,
      a.name,
      a.verkaufspreis_cent,
      a.mwst_prozent,
      a.lagerbestand,
      a.lager_tracking,
      a.bild_url,
      a.bild_base64,
      a.hat_varianten,
      a.varianten_groessen,
      a.varianten_farben,
      a.varianten_material,
      a.varianten_bestand,
      a.preis_kids_cent,
      a.preis_erwachsene_cent,
      a.hat_preiskategorien,
      a.groessen_kids,
      a.groessen_erwachsene,
      kat.name as kategorie_name,
      kat.farbe as kategorie_farbe,
      kat.icon as kategorie_icon,
      kat.id as kategorie_id,
      ag.name as artikelgruppe_name,
      ag.farbe as artikelgruppe_farbe,
      ag.icon as artikelgruppe_icon,
      ag.id as artikelgruppe_id
    FROM artikel a
    LEFT JOIN artikelgruppen kat ON a.kategorie_id = kat.id
    LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
    WHERE a.aktiv = TRUE AND a.sichtbar_kasse = TRUE
    ORDER BY kat.sortierung ASC, a.name ASC
  `;
  params = [];

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Kassen-Artikel:', { error: error });
      logger.error('SQL Fehler Details:', { error: {
        message: error.message,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        code: error.code
      } });
      return res.status(500).json({ 
        error: 'Fehler beim Abrufen der Kassen-Artikel',
        details: error.message 
      });
    }
    
    // Gruppiere nach Kategorien für Touch-Interface
    const kategorien = {};
    results.forEach(artikel => {
      const katId = artikel.kategorie_id;
      if (!kategorien[katId]) {
        kategorien[katId] = {
          kategorie_id: katId,
          name: artikel.kategorie_name,
          farbe_hex: artikel.kategorie_farbe,
          icon: artikel.kategorie_icon,
          artikel: []
        };
      }
      
      // Parse JSON variant fields
      const parseJson = (val) => {
        if (!val) return null;
        try { return typeof val === 'string' ? JSON.parse(val) : val; }
        catch { return null; }
      };

      kategorien[katId].artikel.push({
        artikel_id: artikel.artikel_id,
        name: artikel.name,
        verkaufspreis_cent: artikel.verkaufspreis_cent,
        verkaufspreis_euro: artikel.verkaufspreis_cent / 100,
        mwst_prozent: artikel.mwst_prozent,
        lagerbestand: artikel.lagerbestand,
        lager_tracking: artikel.lager_tracking,
        bild_url: artikel.bild_url,
        bild_base64: artikel.bild_base64,
        verfuegbar: artikel.lager_tracking ? artikel.lagerbestand > 0 : true,
        // Varianten-Daten
        hat_varianten: artikel.hat_varianten === 1,
        varianten_groessen: parseJson(artikel.varianten_groessen) || [],
        varianten_farben: parseJson(artikel.varianten_farben) || [],
        varianten_material: parseJson(artikel.varianten_material) || [],
        varianten_bestand: parseJson(artikel.varianten_bestand) || {},
        hat_preiskategorien: artikel.hat_preiskategorien === 1,
        preis_kids_cent: artikel.preis_kids_cent,
        preis_kids_euro: artikel.preis_kids_cent ? artikel.preis_kids_cent / 100 : null,
        preis_erwachsene_cent: artikel.preis_erwachsene_cent,
        preis_erwachsene_euro: artikel.preis_erwachsene_cent ? artikel.preis_erwachsene_cent / 100 : null,
        groessen_kids: parseJson(artikel.groessen_kids) || [],
        groessen_erwachsene: parseJson(artikel.groessen_erwachsene) || []
      });
    });
    
    const formattedData = Object.values(kategorien);
    res.json({ success: true, data: formattedData });
  });
});

// GET /api/artikel/:id - Einzelnen Artikel abrufen
router.get('/:id', (req, res) => {
  // Super-Admin Check (darf alles sehen)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }

  const query = `
    SELECT
      a.*,
      ag.name as kategorie_name,
      ag.farbe as kategorie_farbe
    FROM artikel a
    LEFT JOIN artikelgruppen ag ON a.kategorie_id = ag.id
    WHERE a.artikel_id = ? AND a.dojo_id = ?
  `;

  db.query(query, [req.params.id, dojoId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen des Artikels:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Abrufen des Artikels' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    
    const artikel = formatArtikel(results[0]);
    // DEBUG: Log loaded Handelskalkulation fields
    logger.debug('GET /artikel/:id - Handelskalkulation:', {
      listeneinkaufspreis_euro: artikel.listeneinkaufspreis_euro,
      lieferrabatt_prozent: artikel.lieferrabatt_prozent,
      gemeinkosten_prozent: artikel.gemeinkosten_prozent,
      gewinnzuschlag_prozent: artikel.gewinnzuschlag_prozent,
      verkaufspreis_euro: artikel.verkaufspreis_euro
    });
    res.json({ success: true, data: artikel });
  });
});

// POST /api/artikel - Neuen Artikel erstellen
router.post('/', (req, res) => {
  // Super-Admin Check (darf alles)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }

  const {
    kategorie_id, artikelgruppe_id, name, beschreibung, ean_code, artikel_nummer,
    einkaufspreis_euro, zusatzkosten_euro, marge_prozent, verkaufspreis_euro, mwst_prozent,
    // Handelskalkulation Felder (Einzelpreis)
    listeneinkaufspreis_euro, lieferrabatt_prozent, lieferskonto_prozent, bezugskosten_euro,
    gemeinkosten_prozent, gewinnzuschlag_prozent,
    kundenskonto_prozent, kundenrabatt_prozent,
    // Handelskalkulation Felder (Größenabhängig)
    listeneinkaufspreis_kids_euro, listeneinkaufspreis_erwachsene_euro,
    bezugskosten_kids_euro, bezugskosten_erwachsene_euro,
    lagerbestand, mindestbestand, lager_tracking,
    farbe_hex, aktiv, sichtbar_kasse,
    // Varianten-Felder
    hat_varianten, varianten_groessen, varianten_farben, varianten_material, varianten_bestand,
    preis_kids_euro, preis_erwachsene_euro,
    hat_preiskategorien, groessen_kids, groessen_erwachsene
  } = req.body;

  // DEBUG: Log Handelskalkulation fields beim Erstellen
  logger.debug('POST /artikel - Handelskalkulation:', {
    listeneinkaufspreis_euro, bezugskosten_euro,
    listeneinkaufspreis_kids_euro, listeneinkaufspreis_erwachsene_euro,
    gemeinkosten_prozent, gewinnzuschlag_prozent,
    verkaufspreis_euro, preis_kids_euro, preis_erwachsene_euro
  });

  // Validierung
  if (!kategorie_id || !name || !verkaufspreis_euro) {
    logger.debug('❌ POST /artikel - Validierung fehlgeschlagen:', {
      kategorie_id, name, verkaufspreis_euro,
      hat_preiskategorien, preis_kids_euro, preis_erwachsene_euro
    });
    return res.status(400).json({
      error: 'Kategorie, Name und Verkaufspreis sind erforderlich'
    });
  }

  // Preise in Cent umwandeln
  const verkaufspreis_cent = Math.round(parseFloat(verkaufspreis_euro) * 100);
  const einkaufspreis_cent = einkaufspreis_euro ? Math.round(parseFloat(einkaufspreis_euro) * 100) : 0;
  const zusatzkosten_cent = zusatzkosten_euro ? Math.round(parseFloat(zusatzkosten_euro) * 100) : 0;
  const marge_p = marge_prozent ? parseFloat(marge_prozent) : null;

  // Handelskalkulation - Cent-Umwandlung
  const listeneinkaufspreis_cent = listeneinkaufspreis_euro ? Math.round(parseFloat(listeneinkaufspreis_euro) * 100) : 0;
  const bezugskosten_cent = bezugskosten_euro ? Math.round(parseFloat(bezugskosten_euro) * 100) : 0;
  const lieferrabatt_p = lieferrabatt_prozent ? parseFloat(lieferrabatt_prozent) : 0;
  const lieferskonto_p = lieferskonto_prozent ? parseFloat(lieferskonto_prozent) : 0;
  const gemeinkosten_p = gemeinkosten_prozent ? parseFloat(gemeinkosten_prozent) : 0;
  const gewinnzuschlag_p = gewinnzuschlag_prozent ? parseFloat(gewinnzuschlag_prozent) : 0;
  const kundenskonto_p = kundenskonto_prozent ? parseFloat(kundenskonto_prozent) : 0;
  const kundenrabatt_p = kundenrabatt_prozent ? parseFloat(kundenrabatt_prozent) : 0;

  // Größenabhängige EK-Preise in Cent
  const listeneinkaufspreis_kids_cent = listeneinkaufspreis_kids_euro ? Math.round(parseFloat(listeneinkaufspreis_kids_euro) * 100) : 0;
  const listeneinkaufspreis_erwachsene_cent = listeneinkaufspreis_erwachsene_euro ? Math.round(parseFloat(listeneinkaufspreis_erwachsene_euro) * 100) : 0;
  const bezugskosten_kids_cent = bezugskosten_kids_euro ? Math.round(parseFloat(bezugskosten_kids_euro) * 100) : 0;
  const bezugskosten_erwachsene_cent = bezugskosten_erwachsene_euro ? Math.round(parseFloat(bezugskosten_erwachsene_euro) * 100) : 0;

  // Varianten-Preise (VK) in Cent
  const preis_kids_cent = preis_kids_euro ? Math.round(parseFloat(preis_kids_euro) * 100) : null;
  const preis_erwachsene_cent = preis_erwachsene_euro ? Math.round(parseFloat(preis_erwachsene_euro) * 100) : null;

  // TODO: Bild-Upload implementieren
  let bild_url = null;
  let bild_base64 = null;

  const query = `
    INSERT INTO artikel (
      kategorie_id, artikelgruppe_id, name, beschreibung, ean_code, artikel_nummer,
      einkaufspreis_cent, zusatzkosten_cent, marge_prozent, verkaufspreis_cent, mwst_prozent,
      listeneinkaufspreis_cent, lieferrabatt_prozent, lieferskonto_prozent, bezugskosten_cent,
      gemeinkosten_prozent, gewinnzuschlag_prozent,
      kundenskonto_prozent, kundenrabatt_prozent,
      listeneinkaufspreis_kids_cent, listeneinkaufspreis_erwachsene_cent,
      bezugskosten_kids_cent, bezugskosten_erwachsene_cent,
      lagerbestand, mindestbestand, lager_tracking,
      bild_url, bild_base64, farbe_hex, aktiv, sichtbar_kasse, dojo_id,
      hat_varianten, varianten_groessen, varianten_farben, varianten_material, varianten_bestand,
      preis_kids_cent, preis_erwachsene_cent, hat_preiskategorien, groessen_kids, groessen_erwachsene
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    kategorie_id, artikelgruppe_id, name, beschreibung, ean_code, artikel_nummer,
    einkaufspreis_cent, zusatzkosten_cent, marge_p, verkaufspreis_cent, mwst_prozent || 19.00,
    listeneinkaufspreis_cent, lieferrabatt_p, lieferskonto_p, bezugskosten_cent,
    gemeinkosten_p, gewinnzuschlag_p,
    kundenskonto_p, kundenrabatt_p,
    listeneinkaufspreis_kids_cent, listeneinkaufspreis_erwachsene_cent,
    bezugskosten_kids_cent, bezugskosten_erwachsene_cent,
    lagerbestand || 0, mindestbestand || 0, lager_tracking !== 'false',
    bild_url, bild_base64, farbe_hex || '#FFFFFF',
    aktiv !== 'false', sichtbar_kasse !== 'false', dojoId,
    hat_varianten ? 1 : 0,
    varianten_groessen ? JSON.stringify(varianten_groessen) : null,
    varianten_farben ? JSON.stringify(varianten_farben) : null,
    varianten_material ? JSON.stringify(varianten_material) : null,
    varianten_bestand ? JSON.stringify(varianten_bestand) : null,
    preis_kids_cent, preis_erwachsene_cent,
    hat_preiskategorien ? 1 : 0,
    groessen_kids ? JSON.stringify(groessen_kids) : null,
    groessen_erwachsene ? JSON.stringify(groessen_erwachsene) : null
  ];
  
  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Erstellen des Artikels:', { error: error });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Artikel-Nummer bereits vorhanden' });
      }
      return res.status(500).json({ error: 'Fehler beim Erstellen des Artikels' });
    }
    
    // Lagerbewegung protokollieren
    if (lagerbestand && lagerbestand > 0) {
      createLagerbewegung(
        results.insertId, 
        'eingang', 
        parseInt(lagerbestand), 
        0, 
        parseInt(lagerbestand),
        'Artikel-Erstellung - Anfangsbestand',
        req.user_id || null
      ).catch(err => logger.warn('Lagerbewegung nicht protokolliert:', { details: err.message }));
    }
    res.json({ 
      success: true, 
      artikel_id: results.insertId,
      message: 'Artikel erfolgreich erstellt' 
    });
  });
});

// PUT /api/artikel/:id - Artikel aktualisieren
router.put('/:id', (req, res) => {
  // Super-Admin Check (darf alles)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }

  const artikel_id = req.params.id;
  const {
    kategorie_id, artikelgruppe_id, name, beschreibung, ean_code, artikel_nummer,
    einkaufspreis_euro, zusatzkosten_euro, marge_prozent, verkaufspreis_euro, mwst_prozent,
    // Handelskalkulation Felder (Einzelpreis)
    listeneinkaufspreis_euro, lieferrabatt_prozent, lieferskonto_prozent, bezugskosten_euro,
    gemeinkosten_prozent, gewinnzuschlag_prozent,
    kundenskonto_prozent, kundenrabatt_prozent,
    // Handelskalkulation Felder (Größenabhängig)
    listeneinkaufspreis_kids_euro, listeneinkaufspreis_erwachsene_euro,
    bezugskosten_kids_euro, bezugskosten_erwachsene_euro,
    lagerbestand, mindestbestand, lager_tracking,
    farbe_hex, aktiv, sichtbar_kasse,
    // Varianten-Felder
    hat_varianten, varianten_groessen, varianten_farben, varianten_material, varianten_bestand,
    preis_kids_euro, preis_erwachsene_euro,
    hat_preiskategorien, groessen_kids, groessen_erwachsene
  } = req.body;

  // DEBUG: Log Handelskalkulation fields
  logger.debug('PUT /artikel/:id - Handelskalkulation:', {
    listeneinkaufspreis_euro, bezugskosten_euro,
    listeneinkaufspreis_kids_euro, listeneinkaufspreis_erwachsene_euro,
    gemeinkosten_prozent, gewinnzuschlag_prozent,
    verkaufspreis_euro, preis_kids_euro, preis_erwachsene_euro
  });

  // Zuerst aktuellen Artikel abrufen
  db.query('SELECT * FROM artikel WHERE artikel_id = ? AND dojo_id = ?', [artikel_id, dojoId], (error, currentResults) => {
    if (error) {
      logger.error('Fehler beim Abrufen des aktuellen Artikels:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Abrufen des aktuellen Artikels' });
    }

    if (currentResults.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }

    const currentArtikel = currentResults[0];

    // Preise in Cent umwandeln
    const verkaufspreis_cent = verkaufspreis_euro ? Math.round(parseFloat(verkaufspreis_euro) * 100) : currentArtikel.verkaufspreis_cent;
    const einkaufspreis_cent = einkaufspreis_euro ? Math.round(parseFloat(einkaufspreis_euro) * 100) : currentArtikel.einkaufspreis_cent;
    const zusatzkosten_cent = zusatzkosten_euro !== undefined ? Math.round(parseFloat(zusatzkosten_euro || 0) * 100) : (currentArtikel.zusatzkosten_cent || 0);

    let updateFields = [];
    let updateValues = [];

    // Dynamische Update-Felder
    const fields = {
      kategorie_id, artikelgruppe_id, name, beschreibung, ean_code, artikel_nummer,
      mwst_prozent, marge_prozent, mindestbestand, lager_tracking, farbe_hex, aktiv, sichtbar_kasse,
      // Handelskalkulation Prozentsätze
      lieferrabatt_prozent, lieferskonto_prozent, gemeinkosten_prozent, gewinnzuschlag_prozent,
      kundenskonto_prozent, kundenrabatt_prozent
    };

    // Nur geänderte Felder hinzufügen
    Object.entries(fields).forEach(([field, value]) => {
      if (value !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(value);
      }
    });

    // Preise hinzufügen
    if (einkaufspreis_euro !== undefined) {
      updateFields.push('einkaufspreis_cent = ?');
      updateValues.push(einkaufspreis_cent);
    }

    if (zusatzkosten_euro !== undefined) {
      updateFields.push('zusatzkosten_cent = ?');
      updateValues.push(zusatzkosten_cent);
    }

    if (verkaufspreis_euro !== undefined) {
      updateFields.push('verkaufspreis_cent = ?');
      updateValues.push(verkaufspreis_cent);
    }

    // Handelskalkulation Preise hinzufügen
    if (listeneinkaufspreis_euro !== undefined) {
      const listeneinkaufspreis_cent = Math.round(parseFloat(listeneinkaufspreis_euro || 0) * 100);
      updateFields.push('listeneinkaufspreis_cent = ?');
      updateValues.push(listeneinkaufspreis_cent);
    }

    if (bezugskosten_euro !== undefined) {
      const bezugskosten_cent = Math.round(parseFloat(bezugskosten_euro || 0) * 100);
      updateFields.push('bezugskosten_cent = ?');
      updateValues.push(bezugskosten_cent);
    }

    // Größenabhängige EK-Preise
    if (listeneinkaufspreis_kids_euro !== undefined) {
      const listeneinkaufspreis_kids_cent = Math.round(parseFloat(listeneinkaufspreis_kids_euro || 0) * 100);
      updateFields.push('listeneinkaufspreis_kids_cent = ?');
      updateValues.push(listeneinkaufspreis_kids_cent);
    }
    if (listeneinkaufspreis_erwachsene_euro !== undefined) {
      const listeneinkaufspreis_erwachsene_cent = Math.round(parseFloat(listeneinkaufspreis_erwachsene_euro || 0) * 100);
      updateFields.push('listeneinkaufspreis_erwachsene_cent = ?');
      updateValues.push(listeneinkaufspreis_erwachsene_cent);
    }
    if (bezugskosten_kids_euro !== undefined) {
      const bezugskosten_kids_cent = Math.round(parseFloat(bezugskosten_kids_euro || 0) * 100);
      updateFields.push('bezugskosten_kids_cent = ?');
      updateValues.push(bezugskosten_kids_cent);
    }
    if (bezugskosten_erwachsene_euro !== undefined) {
      const bezugskosten_erwachsene_cent = Math.round(parseFloat(bezugskosten_erwachsene_euro || 0) * 100);
      updateFields.push('bezugskosten_erwachsene_cent = ?');
      updateValues.push(bezugskosten_erwachsene_cent);
    }

    // Varianten-Felder
    if (hat_varianten !== undefined) {
      updateFields.push('hat_varianten = ?');
      updateValues.push(hat_varianten ? 1 : 0);
    }
    if (varianten_groessen !== undefined) {
      updateFields.push('varianten_groessen = ?');
      updateValues.push(varianten_groessen ? JSON.stringify(varianten_groessen) : null);
    }
    if (varianten_farben !== undefined) {
      updateFields.push('varianten_farben = ?');
      updateValues.push(varianten_farben ? JSON.stringify(varianten_farben) : null);
    }
    if (varianten_material !== undefined) {
      updateFields.push('varianten_material = ?');
      updateValues.push(varianten_material ? JSON.stringify(varianten_material) : null);
    }
    if (varianten_bestand !== undefined) {
      updateFields.push('varianten_bestand = ?');
      updateValues.push(varianten_bestand ? JSON.stringify(varianten_bestand) : null);
    }
    if (preis_kids_euro !== undefined) {
      const preis_kids_cent = preis_kids_euro ? Math.round(parseFloat(preis_kids_euro) * 100) : null;
      updateFields.push('preis_kids_cent = ?');
      updateValues.push(preis_kids_cent);
    }
    if (preis_erwachsene_euro !== undefined) {
      const preis_erwachsene_cent = preis_erwachsene_euro ? Math.round(parseFloat(preis_erwachsene_euro) * 100) : null;
      updateFields.push('preis_erwachsene_cent = ?');
      updateValues.push(preis_erwachsene_cent);
    }
    if (hat_preiskategorien !== undefined) {
      updateFields.push('hat_preiskategorien = ?');
      updateValues.push(hat_preiskategorien ? 1 : 0);
    }
    if (groessen_kids !== undefined) {
      updateFields.push('groessen_kids = ?');
      updateValues.push(groessen_kids ? JSON.stringify(groessen_kids) : null);
    }
    if (groessen_erwachsene !== undefined) {
      updateFields.push('groessen_erwachsene = ?');
      updateValues.push(groessen_erwachsene ? JSON.stringify(groessen_erwachsene) : null);
    }

    // TODO: Bild-Upload für Updates implementieren
    
    // Lagerbestand separat behandeln (wegen Lagerbewegung)
    let lagerbestandChanged = false;
    let alterBestand = currentArtikel.lagerbestand;
    let neuerBestand = alterBestand;
    
    if (lagerbestand !== undefined && parseInt(lagerbestand) !== alterBestand) {
      lagerbestandChanged = true;
      neuerBestand = parseInt(lagerbestand);
      updateFields.push('lagerbestand = ?');
      updateValues.push(neuerBestand);
    }
    
    if (updateFields.length === 0) {
      logger.debug('❌ PUT /artikel - Keine Änderungen erkannt:', { artikel_id, body: req.body });
      return res.status(400).json({ error: 'Keine Änderungen erkannt' });
    }
    
    updateFields.push('aktualisiert_am = CURRENT_TIMESTAMP');
    updateValues.push(artikel_id);

    const query = `UPDATE artikel SET ${updateFields.join(', ')} WHERE artikel_id = ? AND dojo_id = ?`;
    updateValues.push(dojoId);

    db.query(query, updateValues, (error, results) => {
      if (error) {
        logger.error('Fehler beim Aktualisieren des Artikels:', { error: error });
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Artikel-Nummer bereits vorhanden' });
        }
        return res.status(500).json({ error: 'Fehler beim Aktualisieren des Artikels' });
      }
      
      // Lagerbewegung protokollieren bei Bestandsänderung
      if (lagerbestandChanged) {
        const mengeDiff = neuerBestand - alterBestand;
        const bewegungsart = mengeDiff > 0 ? 'eingang' : 'ausgang';
        const grund = `Manuelle Bestandskorrektur: ${alterBestand} → ${neuerBestand}`;
        
        createLagerbewegung(
          artikel_id, 
          bewegungsart, 
          mengeDiff, 
          alterBestand, 
          neuerBestand,
          grund,
          req.user_id || null
        ).catch(err => logger.warn('Lagerbewegung nicht protokolliert:', { details: err.message }));
      }
      res.json({ 
        success: true, 
        message: 'Artikel erfolgreich aktualisiert',
        changes: updateFields.length - 1 // -1 wegen aktualisiert_am
      });
    });
  });
});

// DELETE /api/artikel/:id - Artikel löschen oder archivieren
// Löschen nur wenn kein Verkauf existiert, sonst nur archivieren
router.delete('/:id', (req, res) => {
  // Super-Admin Check (darf alles)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Hole dojo_id aus verschiedenen Quellen
  const dojoId = req.tenant?.dojo_id || req.query.dojo_id || req.dojo_id || req.user?.dojo_id || (isSuperAdmin ? 2 : null);

  if (!isSuperAdmin && !dojoId) {
    return res.status(403).json({ error: 'No tenant' });
  }

  const artikelId = req.params.id;

  // Prüfe ob Artikel verkauft wurde
  const checkSalesQuery = 'SELECT COUNT(*) as verkauf_count FROM verkauf_positionen WHERE artikel_id = ?';

  db.query(checkSalesQuery, [artikelId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Prüfen der Verkäufe:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Prüfen der Verkäufe' });
    }

    const hasBeenSold = results[0].verkauf_count > 0;

    if (hasBeenSold) {
      // Artikel wurde verkauft -> nur archivieren (soft delete)
      const archiveQuery = 'UPDATE artikel SET aktiv = FALSE, aktualisiert_am = CURRENT_TIMESTAMP WHERE artikel_id = ? AND dojo_id = ?';

      db.query(archiveQuery, [artikelId, dojoId], (error, results) => {
        if (error) {
          logger.error('Fehler beim Archivieren des Artikels:', { error: error });
          return res.status(500).json({ error: 'Fehler beim Archivieren des Artikels' });
        }

        if (results.affectedRows === 0) {
          return res.status(404).json({ error: 'Artikel nicht gefunden' });
        }
        res.json({
          success: true,
          action: 'archived',
          message: 'Artikel wurde archiviert (Verkäufe vorhanden)'
        });
      });
    } else {
      // Artikel wurde nie verkauft -> komplett löschen
      const deleteQuery = 'DELETE FROM artikel WHERE artikel_id = ? AND dojo_id = ?';

      db.query(deleteQuery, [artikelId, dojoId], (error, results) => {
        if (error) {
          logger.error('Fehler beim Löschen des Artikels:', { error: error });
          return res.status(500).json({ error: 'Fehler beim Löschen des Artikels' });
        }

        if (results.affectedRows === 0) {
          return res.status(404).json({ error: 'Artikel nicht gefunden' });
        }
        res.json({
          success: true,
          action: 'deleted',
          message: 'Artikel wurde gelöscht'
        });
      });
    }
  });
});

// =====================================================================================
// LAGERBESTAND
// =====================================================================================

// POST /api/artikel/:id/lager - Lagerbestand ändern
router.post('/:id/lager', (req, res) => {
  // Super-Admin Check (darf alles)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }

  const artikel_id = req.params.id;
  const { bewegungsart, menge, grund } = req.body;

  if (!bewegungsart || !menge) {
    return res.status(400).json({ error: 'Bewegungsart und Menge sind erforderlich' });
  }

  // Aktuellen Bestand abrufen
  db.query('SELECT lagerbestand FROM artikel WHERE artikel_id = ? AND dojo_id = ?', [artikel_id, dojoId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen des Lagerbestands:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Abrufen des Lagerbestands' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    
    const alterBestand = results[0].lagerbestand;
    let neuerBestand;
    let mengeDiff;
    
    if (bewegungsart === 'eingang') {
      neuerBestand = alterBestand + parseInt(menge);
      mengeDiff = parseInt(menge);
    } else if (bewegungsart === 'ausgang') {
      neuerBestand = Math.max(0, alterBestand - parseInt(menge));
      mengeDiff = -(parseInt(menge));
    } else {
      return res.status(400).json({ error: 'Ungültige Bewegungsart' });
    }
    
    // Bestand aktualisieren
    db.query(
      'UPDATE artikel SET lagerbestand = ?, aktualisiert_am = CURRENT_TIMESTAMP WHERE artikel_id = ?',
      [neuerBestand, artikel_id],
      (updateError) => {
        if (updateError) {
          logger.error('Fehler beim Aktualisieren des Lagerbestands:', { error: updateError });
          return res.status(500).json({ error: 'Fehler beim Aktualisieren des Lagerbestands' });
        }
        
        // Lagerbewegung protokollieren
        createLagerbewegung(
          artikel_id,
          bewegungsart,
          mengeDiff,
          alterBestand,
          neuerBestand,
          grund || `${bewegungsart.charAt(0).toUpperCase() + bewegungsart.slice(1)} - manuell`,
          req.user_id || null
        ).then(() => {
          res.json({
            success: true,
            alter_bestand: alterBestand,
            neuer_bestand: neuerBestand,
            menge_diff: mengeDiff,
            message: 'Lagerbestand erfolgreich aktualisiert'
          });
        }).catch(err => {
          logger.error('Lagerbewegung nicht protokolliert:', { error: err });
          res.json({
            success: true,
            alter_bestand: alterBestand,
            neuer_bestand: neuerBestand,
            menge_diff: mengeDiff,
            message: 'Lagerbestand aktualisiert, aber Bewegung nicht protokolliert'
          });
        });
      }
    );
  });
});

// GET /api/artikel/:id/lager - Lagerbewegungen für Artikel
router.get('/:id/lager', (req, res) => {
  // Super-Admin Check (darf alles sehen)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }

  const query = `
    SELECT
      lb.bewegung_id,
      lb.bewegungsart,
      lb.menge,
      lb.alter_bestand,
      lb.neuer_bestand,
      lb.grund,
      lb.verkauf_id,
      lb.durchgefuehrt_von_name,
      lb.bewegung_timestamp
    FROM lager_bewegungen lb
    JOIN artikel a ON lb.artikel_id = a.artikel_id
    WHERE lb.artikel_id = ? AND a.dojo_id = ?
    ORDER BY lb.bewegung_timestamp DESC
    LIMIT 50
  `;

  db.query(query, [req.params.id, dojoId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Lagerbewegungen:', { error: error });
      return res.status(500).json({ error: 'Fehler beim Abrufen der Lagerbewegungen' });
    }
    res.json({ success: true, data: results });
  });
});

// =====================================================================================
// STATISTIKEN
// =====================================================================================

// GET /api/artikel/stats - Artikel-Statistiken
router.get('/stats/overview', (req, res) => {
  // Super-Admin Check (darf alles sehen)
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';

  // Tenant check (Super-Admin braucht kein dojo_id)
  if (!isSuperAdmin && !req.tenant?.dojo_id) {
    return res.status(403).json({ error: 'No tenant' });
  }

  // Super-Admin ohne dojo_id - Standard-Dojo 2 verwenden
  const dojoId = req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
  if (!dojoId) {
    return res.status(403).json({ error: 'No dojo_id available' });
  }
  const queries = {
    gesamt: ['SELECT COUNT(*) as anzahl FROM artikel WHERE aktiv = TRUE AND dojo_id = ?', [dojoId]],
    kategorien: ['SELECT COUNT(*) as anzahl FROM artikel_kategorien WHERE aktiv = TRUE AND dojo_id = ?', [dojoId]],
    ausverkauft: ['SELECT COUNT(*) as anzahl FROM artikel WHERE aktiv = TRUE AND lager_tracking = TRUE AND lagerbestand = 0 AND dojo_id = ?', [dojoId]],
    nachbestellen: ['SELECT COUNT(*) as anzahl FROM artikel WHERE aktiv = TRUE AND lager_tracking = TRUE AND lagerbestand <= mindestbestand AND lagerbestand > 0 AND dojo_id = ?', [dojoId]],
    lagerwert: ['SELECT SUM(lagerbestand * einkaufspreis_cent) as wert_cent FROM artikel WHERE aktiv = TRUE AND lager_tracking = TRUE AND dojo_id = ?', [dojoId]]
  };


  Promise.all(Object.entries(queries).map(([key, queryData]) =>
    new Promise((resolve) => {
      const [query, params] = queryData;
      db.query(query, params, (error, results) => {
        if (error) {
          logger.error('Fehler bei ${key}-Statistik:', { error: error });
          resolve({ key, value: 0 });
        } else {
          const value = key === 'lagerwert' ? 
            (results[0].wert_cent || 0) / 100 : 
            results[0].anzahl || 0;
          resolve({ key, value });
        }
      });
    })
  )).then(results => {
    const stats = {};
    results.forEach(({ key, value }) => {
      stats[key] = value;
    });
    res.json({ success: true, data: stats });
  });
});

module.exports = router;