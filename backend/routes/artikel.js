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