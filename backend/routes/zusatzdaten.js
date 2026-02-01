/**
 * Mitglied Zusatzdaten Routes
 * Verwaltung von Lehrgängen, Ehrungen, Zertifikaten etc.
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');

// ============================================================================
// GET /api/zusatzdaten/mitglied/:mitglied_id
// Alle Zusatzdaten eines Mitglieds abrufen
// ============================================================================
router.get('/mitglied/:mitglied_id', async (req, res) => {
  const { mitglied_id } = req.params;
  const { dojo_id, typ } = req.query;
  
  try {
    let query = `
      SELECT z.*, m.vorname, m.nachname
      FROM mitglied_zusatzdaten z
      JOIN mitglieder m ON z.mitglied_id = m.mitglied_id
      WHERE z.mitglied_id = ?
    `;
    const params = [mitglied_id];
    
    if (dojo_id) {
      query += ' AND z.dojo_id = ?';
      params.push(dojo_id);
    }
    
    if (typ) {
      query += ' AND z.typ = ?';
      params.push(typ);
    }
    
    query += ' ORDER BY z.datum DESC, z.erstellt_am DESC';
    
    const [results] = await db.query(query, params);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Zusatzdaten:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/zusatzdaten/:id
// Einzelne Zusatzdaten abrufen
// ============================================================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [results] = await db.query(
      'SELECT * FROM mitglied_zusatzdaten WHERE id = ?',
      [id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    }
    
    res.json({ success: true, data: results[0] });
  } catch (error) {
    logger.error('Fehler beim Abrufen:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// POST /api/zusatzdaten
// Neue Zusatzdaten erstellen
// ============================================================================
router.post('/', async (req, res) => {
  const {
    mitglied_id,
    dojo_id,
    typ,
    bezeichnung,
    datum,
    datum_bis,
    ort,
    beschreibung,
    aussteller,
    erstellt_von
  } = req.body;
  
  if (!mitglied_id || !dojo_id || !bezeichnung) {
    return res.status(400).json({
      success: false,
      error: 'mitglied_id, dojo_id und bezeichnung sind erforderlich'
    });
  }
  
  try {
    const [result] = await db.query(
      `INSERT INTO mitglied_zusatzdaten 
       (mitglied_id, dojo_id, typ, bezeichnung, datum, datum_bis, ort, beschreibung, aussteller, erstellt_von)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mitglied_id, dojo_id, typ || 'Sonstiges', bezeichnung, datum || null, datum_bis || null, ort || null, beschreibung || null, aussteller || null, erstellt_von || null]
    );
    
    res.json({
      success: true,
      message: 'Zusatzdaten erfolgreich erstellt',
      id: result.insertId
    });
  } catch (error) {
    logger.error('Fehler beim Erstellen:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// PUT /api/zusatzdaten/:id
// Zusatzdaten aktualisieren
// ============================================================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    typ,
    bezeichnung,
    datum,
    datum_bis,
    ort,
    beschreibung,
    aussteller
  } = req.body;
  
  try {
    const [result] = await db.query(
      `UPDATE mitglied_zusatzdaten 
       SET typ = ?, bezeichnung = ?, datum = ?, datum_bis = ?, ort = ?, beschreibung = ?, aussteller = ?
       WHERE id = ?`,
      [typ, bezeichnung, datum || null, datum_bis || null, ort || null, beschreibung || null, aussteller || null, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    }
    
    res.json({ success: true, message: 'Zusatzdaten aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// DELETE /api/zusatzdaten/:id
// Zusatzdaten löschen
// ============================================================================
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await db.query(
      'DELETE FROM mitglied_zusatzdaten WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    }
    
    res.json({ success: true, message: 'Zusatzdaten gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen:', { error: error });
    res.status(500).json({ success: false, error: 'Datenbankfehler' });
  }
});

// ============================================================================
// GET /api/zusatzdaten/typen/liste
// Verfügbare Typen abrufen
// ============================================================================
router.get('/typen/liste', (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'Lehrgang', label: 'Lehrgang', icon: '📚' },
      { value: 'Ehrung', label: 'Ehrung', icon: '🏆' },
      { value: 'Zertifikat', label: 'Zertifikat', icon: '📜' },
      { value: 'Auszeichnung', label: 'Auszeichnung', icon: '🎖️' },
      { value: 'Sonstiges', label: 'Sonstiges', icon: '📝' }
    ]
  });
});

module.exports = router;
