// =====================================================================================
// ARTIKEL-VERWALTUNG API-ROUTES - DOJOSOFTWARE VERKAUFSSYSTEM
// =====================================================================================
// Vollständige CRUD-Operationen für Artikel mit Lagerbestand-Tracking
// Deutsche rechtliche Grundlagen beachtet
// =====================================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
// const multer = require('multer'); // TODO: Später für Bild-Uploads hinzufügen
// const path = require('path');
// const fs = require('fs');

// =====================================================================================
// DEVELOPMENT MODE CHECK
// =====================================================================================
const isDevelopment = process.env.NODE_ENV !== 'production';

// =====================================================================================
// MOCK-DATEN FÜR DEVELOPMENT MODE
// =====================================================================================
const MOCK_KATEGORIEN = [
  { kategorie_id: 1, name: 'Gi/Anzüge', beschreibung: 'Kampfsportanzüge', farbe_hex: '#3B82F6', icon: '👔', aktiv: true, reihenfolge: 1, anzahl_artikel: 5 },
  { kategorie_id: 2, name: 'Waffen', beschreibung: 'Trainingswaffen', farbe_hex: '#EF4444', icon: '⚔️', aktiv: true, reihenfolge: 2, anzahl_artikel: 4 },
  { kategorie_id: 3, name: 'Schutzausrüstung', beschreibung: 'Schutz für Training', farbe_hex: '#10B981', icon: '🛡️', aktiv: true, reihenfolge: 3, anzahl_artikel: 6 },
  { kategorie_id: 4, name: 'Prüfungsmaterial', beschreibung: 'Material für Prüfungen', farbe_hex: '#F59E0B', icon: '📜', aktiv: true, reihenfolge: 4, anzahl_artikel: 3 }
];

const MOCK_ARTIKEL = [
  // Gi/Anzüge
  { artikel_id: 1, kategorie_id: 1, artikelgruppe_id: 1, name: 'Karate Gi Weiß Größe 160', beschreibung: 'Klassischer weißer Karate-Anzug', ean_code: '4250123456001', artikel_nummer: 'GI-KAR-W-160', einkaufspreis_cent: 2500, verkaufspreis_cent: 4990, mwst_prozent: 19, lagerbestand: 12, mindestbestand: 5, lager_tracking: true, farbe_hex: '#FFFFFF', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Gi/Anzüge', kategorie_farbe: '#3B82F6', kategorie_icon: '👔', artikelgruppe_name: 'Bekleidung', artikelgruppe_farbe: '#3b82f6', artikelgruppe_icon: '👕', artikelgruppe_vollstaendig: 'Bekleidung', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 2, kategorie_id: 1, artikelgruppe_id: 1, name: 'Judo Gi Blau Größe 170', beschreibung: 'Blauer Judo-Anzug für Wettkämpfe', ean_code: '4250123456002', artikel_nummer: 'GI-JUD-B-170', einkaufspreis_cent: 3500, verkaufspreis_cent: 6990, mwst_prozent: 19, lagerbestand: 8, mindestbestand: 3, lager_tracking: true, farbe_hex: '#1E40AF', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Gi/Anzüge', kategorie_farbe: '#3B82F6', kategorie_icon: '👔', artikelgruppe_name: 'Bekleidung', artikelgruppe_farbe: '#3b82f6', artikelgruppe_icon: '👕', artikelgruppe_vollstaendig: 'Bekleidung', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 3, kategorie_id: 1, artikelgruppe_id: 1, name: 'Taekwondo Dobok Weiß mit schwarzem Kragen', beschreibung: 'Traditioneller Taekwondo-Anzug', ean_code: '4250123456003', artikel_nummer: 'GI-TKD-W-180', einkaufspreis_cent: 2800, verkaufspreis_cent: 5490, mwst_prozent: 19, lagerbestand: 15, mindestbestand: 5, lager_tracking: true, farbe_hex: '#FFFFFF', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Gi/Anzüge', kategorie_farbe: '#3B82F6', kategorie_icon: '👔', artikelgruppe_name: 'Bekleidung', artikelgruppe_farbe: '#3b82f6', artikelgruppe_icon: '👕', artikelgruppe_vollstaendig: 'Bekleidung', erstellt_am: new Date(), aktualisiert_am: new Date() },

  // Waffen
  { artikel_id: 4, kategorie_id: 2, artikelgruppe_id: 2, name: 'Bo Stab Eiche 180cm', beschreibung: 'Traditioneller Bo-Stab aus Eichenholz', ean_code: '4250123456101', artikel_nummer: 'WAF-BO-180', einkaufspreis_cent: 1500, verkaufspreis_cent: 2990, mwst_prozent: 19, lagerbestand: 20, mindestbestand: 10, lager_tracking: true, farbe_hex: '#92400E', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Waffen', kategorie_farbe: '#EF4444', kategorie_icon: '⚔️', artikelgruppe_name: 'Ausrüstung', artikelgruppe_farbe: '#ef4444', artikelgruppe_icon: '🥊', artikelgruppe_vollstaendig: 'Ausrüstung', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 5, kategorie_id: 2, artikelgruppe_id: 2, name: 'Tonfa Paar Hartholz', beschreibung: 'Tonfa-Paar aus robustem Hartholz', ean_code: '4250123456102', artikel_nummer: 'WAF-TON-H', einkaufspreis_cent: 2200, verkaufspreis_cent: 4490, mwst_prozent: 19, lagerbestand: 6, mindestbestand: 4, lager_tracking: true, farbe_hex: '#78350F', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Waffen', kategorie_farbe: '#EF4444', kategorie_icon: '⚔️', artikelgruppe_name: 'Ausrüstung', artikelgruppe_farbe: '#ef4444', artikelgruppe_icon: '🥊', artikelgruppe_vollstaendig: 'Ausrüstung', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 6, kategorie_id: 2, artikelgruppe_id: 2, name: 'Nunchaku Schaumstoff Training', beschreibung: 'Sicheres Training-Nunchaku', ean_code: '4250123456103', artikel_nummer: 'WAF-NUN-S', einkaufspreis_cent: 800, verkaufspreis_cent: 1590, mwst_prozent: 19, lagerbestand: 25, mindestbestand: 10, lager_tracking: true, farbe_hex: '#000000', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Waffen', kategorie_farbe: '#EF4444', kategorie_icon: '⚔️', artikelgruppe_name: 'Ausrüstung', artikelgruppe_farbe: '#ef4444', artikelgruppe_icon: '🥊', artikelgruppe_vollstaendig: 'Ausrüstung', erstellt_am: new Date(), aktualisiert_am: new Date() },

  // Schutzausrüstung
  { artikel_id: 7, kategorie_id: 3, artikelgruppe_id: 2, name: 'Kopfschutz Größe L Rot', beschreibung: 'Kopfschutz für Sparring', ean_code: '4250123456201', artikel_nummer: 'SCH-KOP-L-R', einkaufspreis_cent: 1800, verkaufspreis_cent: 3490, mwst_prozent: 19, lagerbestand: 10, mindestbestand: 5, lager_tracking: true, farbe_hex: '#DC2626', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Schutzausrüstung', kategorie_farbe: '#10B981', kategorie_icon: '🛡️', artikelgruppe_name: 'Ausrüstung', artikelgruppe_farbe: '#ef4444', artikelgruppe_icon: '🥊', artikelgruppe_vollstaendig: 'Ausrüstung', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 8, kategorie_id: 3, artikelgruppe_id: 2, name: 'Tiefschutz Größe M', beschreibung: 'Tiefschutz für Herren', ean_code: '4250123456202', artikel_nummer: 'SCH-TIE-M', einkaufspreis_cent: 1200, verkaufspreis_cent: 2290, mwst_prozent: 19, lagerbestand: 14, mindestbestand: 8, lager_tracking: true, farbe_hex: '#FFFFFF', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Schutzausrüstung', kategorie_farbe: '#10B981', kategorie_icon: '🛡️', artikelgruppe_name: 'Ausrüstung', artikelgruppe_farbe: '#ef4444', artikelgruppe_icon: '🥊', artikelgruppe_vollstaendig: 'Ausrüstung', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 9, kategorie_id: 3, artikelgruppe_id: 2, name: 'Schienbeinschoner Größe L Blau', beschreibung: 'Schienbeinschutz für Wettkampf', ean_code: '4250123456203', artikel_nummer: 'SCH-SHI-L-B', einkaufspreis_cent: 1600, verkaufspreis_cent: 2990, mwst_prozent: 19, lagerbestand: 9, mindestbestand: 6, lager_tracking: true, farbe_hex: '#1E40AF', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Schutzausrüstung', kategorie_farbe: '#10B981', kategorie_icon: '🛡️', artikelgruppe_name: 'Ausrüstung', artikelgruppe_farbe: '#ef4444', artikelgruppe_icon: '🥊', artikelgruppe_vollstaendig: 'Ausrüstung', erstellt_am: new Date(), aktualisiert_am: new Date() },

  // Prüfungsmaterial
  { artikel_id: 10, kategorie_id: 4, artikelgruppe_id: 3, name: 'Prüfungsurkunde Karate', beschreibung: 'Offizielle Karate Prüfungsurkunde', ean_code: '4250123456301', artikel_nummer: 'PRÜ-URK-KAR', einkaufspreis_cent: 150, verkaufspreis_cent: 490, mwst_prozent: 19, lagerbestand: 100, mindestbestand: 50, lager_tracking: true, farbe_hex: '#FBBF24', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Prüfungsmaterial', kategorie_farbe: '#F59E0B', kategorie_icon: '📜', artikelgruppe_name: 'Prüfungsmaterial', artikelgruppe_farbe: '#f59e0b', artikelgruppe_icon: '🎓', artikelgruppe_vollstaendig: 'Prüfungsmaterial', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 11, kategorie_id: 4, artikelgruppe_id: 3, name: 'Bruchtest-Brett Holz 30x30cm', beschreibung: 'Bruchtest-Brett aus Kiefernholz', ean_code: '4250123456302', artikel_nummer: 'PRÜ-BRE-H-30', einkaufspreis_cent: 300, verkaufspreis_cent: 690, mwst_prozent: 19, lagerbestand: 40, mindestbestand: 20, lager_tracking: true, farbe_hex: '#92400E', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Prüfungsmaterial', kategorie_farbe: '#F59E0B', kategorie_icon: '📜', artikelgruppe_name: 'Prüfungsmaterial', artikelgruppe_farbe: '#f59e0b', artikelgruppe_icon: '🎓', artikelgruppe_vollstaendig: 'Prüfungsmaterial', erstellt_am: new Date(), aktualisiert_am: new Date() },
  { artikel_id: 12, kategorie_id: 4, artikelgruppe_id: 3, name: 'Passfotos für Ausweis (10 Stück)', beschreibung: 'Passfoto-Set für Budopässe', ean_code: '4250123456303', artikel_nummer: 'PRÜ-PAS-10', einkaufspreis_cent: 500, verkaufspreis_cent: 990, mwst_prozent: 19, lagerbestand: 30, mindestbestand: 15, lager_tracking: true, farbe_hex: '#FFFFFF', aktiv: true, sichtbar_kasse: true, kategorie_name: 'Prüfungsmaterial', kategorie_farbe: '#F59E0B', kategorie_icon: '📜', artikelgruppe_name: 'Prüfungsmaterial', artikelgruppe_farbe: '#f59e0b', artikelgruppe_icon: '🎓', artikelgruppe_vollstaendig: 'Prüfungsmaterial', erstellt_am: new Date(), aktualisiert_am: new Date() }
];

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
  // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
  if (isDevelopment) {
    console.log('🔧 Development Mode: Verwende Mock-Kategorien');
    return res.json({ success: true, data: MOCK_KATEGORIEN, _dev: true });
  }

  // PRODUCTION MODE: Datenbank verwenden
  const query = `
    SELECT
      kategorie_id,
      name,
      beschreibung,
      farbe_hex,
      icon,
      aktiv,
      reihenfolge,
      (SELECT COUNT(*) FROM artikel WHERE kategorie_id = ak.kategorie_id AND aktiv = TRUE) as anzahl_artikel
    FROM artikel_kategorien ak
    WHERE aktiv = TRUE
    ORDER BY reihenfolge ASC, name ASC
  `;

  db.query(query, (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen der Kategorien:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Kategorien' });
    }
    res.json({ success: true, data: results });
  });
});

// POST /api/artikel/kategorien - Neue Kategorie erstellen
router.post('/kategorien', (req, res) => {
  const { name, beschreibung, farbe_hex, icon, reihenfolge } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  
  const query = `
    INSERT INTO artikel_kategorien (name, beschreibung, farbe_hex, icon, reihenfolge)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(query, [name, beschreibung, farbe_hex || '#3B82F6', icon || 'package', reihenfolge || 0], 
    (error, results) => {
      if (error) {
        console.error('Fehler beim Erstellen der Kategorie:', error);
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
  const { kategorie_id, aktiv, sichtbar_kasse } = req.query;

  // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
  if (isDevelopment) {
    console.log('🔧 Development Mode: Verwende Mock-Artikel');
    let filtered = [...MOCK_ARTIKEL];

    if (kategorie_id) {
      filtered = filtered.filter(a => a.kategorie_id === parseInt(kategorie_id));
    }

    if (aktiv !== undefined) {
      filtered = filtered.filter(a => a.aktiv === (aktiv === 'true'));
    }

    if (sichtbar_kasse !== undefined) {
      filtered = filtered.filter(a => a.sichtbar_kasse === (sichtbar_kasse === 'true'));
    }

    const formattedResults = filtered.map(formatArtikel);
    return res.json({ success: true, data: formattedResults, _dev: true });
  }

  // PRODUCTION MODE: Datenbank verwenden
  let query = `
    SELECT
      a.*,
      ak.name as kategorie_name,
      ak.farbe_hex as kategorie_farbe,
      ak.icon as kategorie_icon,
      ag.name as artikelgruppe_name,
      ag.farbe as artikelgruppe_farbe,
      ag.icon as artikelgruppe_icon,
      CASE
        WHEN ag.parent_id IS NULL THEN ag.name
        ELSE CONCAT(pag.name, ' → ', ag.name)
      END AS artikelgruppe_vollstaendig
    FROM artikel a
    LEFT JOIN artikel_kategorien ak ON a.kategorie_id = ak.kategorie_id
    LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
    LEFT JOIN artikelgruppen pag ON ag.parent_id = pag.id
    WHERE 1=1
  `;
  const params = [];

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

  query += ' ORDER BY ak.reihenfolge ASC, a.name ASC';

  db.query(query, params, (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen der Artikel:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Artikel' });
    }

    const formattedResults = results.map(formatArtikel);
    res.json({ success: true, data: formattedResults });
  });
});

// GET /api/artikel/kasse - Artikel für Kassensystem optimiert
router.get('/kasse', (req, res) => {
  const query = `
    SELECT 
      a.artikel_id,
      a.name,
      a.verkaufspreis_cent,
      a.mwst_prozent,
      a.lagerbestand,
      a.lager_tracking,
      a.bild_url,
      a.bild_base64,
      ak.name as kategorie_name,
      ak.farbe_hex as kategorie_farbe,
      ak.icon as kategorie_icon,
      ak.kategorie_id,
      ag.name as artikelgruppe_name,
      ag.farbe as artikelgruppe_farbe,
      ag.icon as artikelgruppe_icon,
      ag.id as artikelgruppe_id
    FROM artikel a
    LEFT JOIN artikel_kategorien ak ON a.kategorie_id = ak.kategorie_id
    LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
    WHERE a.aktiv = TRUE AND a.sichtbar_kasse = TRUE
    ORDER BY ag.sortierung ASC, ak.reihenfolge ASC, a.name ASC
  `;
  
  db.query(query, (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen der Kassen-Artikel:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Kassen-Artikel' });
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
        verfuegbar: artikel.lager_tracking ? artikel.lagerbestand > 0 : true
      });
    });
    
    const formattedData = Object.values(kategorien);
    res.json({ success: true, data: formattedData });
  });
});

// GET /api/artikel/:id - Einzelnen Artikel abrufen
router.get('/:id', (req, res) => {
  const query = `
    SELECT 
      a.*,
      ak.name as kategorie_name,
      ak.farbe_hex as kategorie_farbe
    FROM artikel a
    JOIN artikel_kategorien ak ON a.kategorie_id = ak.kategorie_id
    WHERE a.artikel_id = ?
  `;
  
  db.query(query, [req.params.id], (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen des Artikels:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen des Artikels' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    
    const artikel = formatArtikel(results[0]);
    res.json({ success: true, data: artikel });
  });
});

// POST /api/artikel - Neuen Artikel erstellen
router.post('/', (req, res) => {
  const {
    kategorie_id, name, beschreibung, ean_code, artikel_nummer,
    einkaufspreis_euro, verkaufspreis_euro, mwst_prozent,
    lagerbestand, mindestbestand, lager_tracking,
    farbe_hex, aktiv, sichtbar_kasse
  } = req.body;
  
  // Validierung
  if (!kategorie_id || !name || !verkaufspreis_euro) {
    return res.status(400).json({ 
      error: 'Kategorie, Name und Verkaufspreis sind erforderlich' 
    });
  }
  
  // Preise in Cent umwandeln
  const verkaufspreis_cent = Math.round(parseFloat(verkaufspreis_euro) * 100);
  const einkaufspreis_cent = einkaufspreis_euro ? Math.round(parseFloat(einkaufspreis_euro) * 100) : 0;
  
  // TODO: Bild-Upload implementieren
  let bild_url = null;
  let bild_base64 = null;
  
  const query = `
    INSERT INTO artikel (
      kategorie_id, name, beschreibung, ean_code, artikel_nummer,
      einkaufspreis_cent, verkaufspreis_cent, mwst_prozent,
      lagerbestand, mindestbestand, lager_tracking,
      bild_url, bild_base64, farbe_hex, aktiv, sichtbar_kasse
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    kategorie_id, name, beschreibung, ean_code, artikel_nummer,
    einkaufspreis_cent, verkaufspreis_cent, mwst_prozent || 19.00,
    lagerbestand || 0, mindestbestand || 0, lager_tracking !== 'false',
    bild_url, bild_base64, farbe_hex || '#FFFFFF', 
    aktiv !== 'false', sichtbar_kasse !== 'false'
  ];
  
  db.query(query, params, (error, results) => {
    if (error) {
      console.error('Fehler beim Erstellen des Artikels:', error);
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
      ).catch(err => console.warn('Lagerbewegung nicht protokolliert:', err.message));
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
  const artikel_id = req.params.id;
  const {
    kategorie_id, name, beschreibung, ean_code, artikel_nummer,
    einkaufspreis_euro, verkaufspreis_euro, mwst_prozent,
    lagerbestand, mindestbestand, lager_tracking,
    farbe_hex, aktiv, sichtbar_kasse
  } = req.body;
  
  // Zuerst aktuellen Artikel abrufen
  db.query('SELECT * FROM artikel WHERE artikel_id = ?', [artikel_id], (error, currentResults) => {
    if (error) {
      console.error('Fehler beim Abrufen des aktuellen Artikels:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen des aktuellen Artikels' });
    }
    
    if (currentResults.length === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    
    const currentArtikel = currentResults[0];
    
    // Preise in Cent umwandeln
    const verkaufspreis_cent = verkaufspreis_euro ? Math.round(parseFloat(verkaufspreis_euro) * 100) : currentArtikel.verkaufspreis_cent;
    const einkaufspreis_cent = einkaufspreis_euro ? Math.round(parseFloat(einkaufspreis_euro) * 100) : currentArtikel.einkaufspreis_cent;
    
    let updateFields = [];
    let updateValues = [];
    
    // Dynamische Update-Felder
    const fields = {
      kategorie_id, name, beschreibung, ean_code, artikel_nummer,
      mwst_prozent, mindestbestand, lager_tracking, farbe_hex, aktiv, sichtbar_kasse
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
    
    if (verkaufspreis_euro !== undefined) {
      updateFields.push('verkaufspreis_cent = ?');
      updateValues.push(verkaufspreis_cent);
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
      return res.status(400).json({ error: 'Keine Änderungen erkannt' });
    }
    
    updateFields.push('aktualisiert_am = CURRENT_TIMESTAMP');
    updateValues.push(artikel_id);
    
    const query = `UPDATE artikel SET ${updateFields.join(', ')} WHERE artikel_id = ?`;
    
    db.query(query, updateValues, (error, results) => {
      if (error) {
        console.error('Fehler beim Aktualisieren des Artikels:', error);
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
        ).catch(err => console.warn('Lagerbewegung nicht protokolliert:', err.message));
      }
      res.json({ 
        success: true, 
        message: 'Artikel erfolgreich aktualisiert',
        changes: updateFields.length - 1 // -1 wegen aktualisiert_am
      });
    });
  });
});

// DELETE /api/artikel/:id - Artikel löschen (soft delete)
router.delete('/:id', (req, res) => {
  const query = 'UPDATE artikel SET aktiv = FALSE, aktualisiert_am = CURRENT_TIMESTAMP WHERE artikel_id = ?';
  
  db.query(query, [req.params.id], (error, results) => {
    if (error) {
      console.error('Fehler beim Deaktivieren des Artikels:', error);
      return res.status(500).json({ error: 'Fehler beim Deaktivieren des Artikels' });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Artikel nicht gefunden' });
    }
    res.json({ success: true, message: 'Artikel erfolgreich deaktiviert' });
  });
});

// =====================================================================================
// LAGERBESTAND
// =====================================================================================

// POST /api/artikel/:id/lager - Lagerbestand ändern
router.post('/:id/lager', (req, res) => {
  const artikel_id = req.params.id;
  const { bewegungsart, menge, grund } = req.body;
  
  if (!bewegungsart || !menge) {
    return res.status(400).json({ error: 'Bewegungsart und Menge sind erforderlich' });
  }
  
  // Aktuellen Bestand abrufen
  db.query('SELECT lagerbestand FROM artikel WHERE artikel_id = ?', [artikel_id], (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen des Lagerbestands:', error);
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
          console.error('Fehler beim Aktualisieren des Lagerbestands:', updateError);
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
          console.error('Lagerbewegung nicht protokolliert:', err);
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
  const query = `
    SELECT 
      bewegung_id,
      bewegungsart,
      menge,
      alter_bestand,
      neuer_bestand,
      grund,
      verkauf_id,
      durchgefuehrt_von_name,
      bewegung_timestamp
    FROM lager_bewegungen
    WHERE artikel_id = ?
    ORDER BY bewegung_timestamp DESC
    LIMIT 50
  `;
  
  db.query(query, [req.params.id], (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen der Lagerbewegungen:', error);
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
  const queries = {
    gesamt: 'SELECT COUNT(*) as anzahl FROM artikel WHERE aktiv = TRUE',
    kategorien: 'SELECT COUNT(*) as anzahl FROM artikel_kategorien WHERE aktiv = TRUE',
    ausverkauft: 'SELECT COUNT(*) as anzahl FROM artikel WHERE aktiv = TRUE AND lager_tracking = TRUE AND lagerbestand = 0',
    nachbestellen: 'SELECT COUNT(*) as anzahl FROM artikel WHERE aktiv = TRUE AND lager_tracking = TRUE AND lagerbestand <= mindestbestand AND lagerbestand > 0',
    lagerwert: 'SELECT SUM(lagerbestand * einkaufspreis_cent) as wert_cent FROM artikel WHERE aktiv = TRUE AND lager_tracking = TRUE'
  };
  
  Promise.all(Object.entries(queries).map(([key, query]) => 
    new Promise((resolve) => {
      db.query(query, (error, results) => {
        if (error) {
          console.error(`Fehler bei ${key}-Statistik:`, error);
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