// Personal Check-in API Routes
const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/personal-checkin - Alle Personal Check-ins für heute abrufen
router.get("/", (req, res) => {
  const { datum } = req.query;
  const targetDate = datum || new Date().toISOString().split('T')[0];
  
  const query = `
    SELECT 
      pc.*,
      p.vorname,
      p.nachname,
      p.position,
      p.stundenlohn,
      CASE 
        WHEN pc.checkout_time IS NOT NULL THEN 
          TIMESTAMPDIFF(MINUTE, pc.checkin_time, pc.checkout_time)
        ELSE 
          TIMESTAMPDIFF(MINUTE, pc.checkin_time, NOW())
      END as aktuelle_arbeitszeit_minuten,
      CASE 
        WHEN pc.checkout_time IS NOT NULL THEN 
          ROUND((TIMESTAMPDIFF(MINUTE, pc.checkin_time, pc.checkout_time) / 60.0) * p.stundenlohn, 2)
        ELSE 
          ROUND((TIMESTAMPDIFF(MINUTE, pc.checkin_time, NOW()) / 60.0) * p.stundenlohn, 2)
      END as aktuelle_kosten
    FROM personal_checkin pc
    JOIN personal p ON pc.personal_id = p.personal_id
    WHERE DATE(pc.checkin_time) = ?
    ORDER BY pc.checkin_time DESC
  `;
  
  db.query(query, [targetDate], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Personal Check-ins:', { error: error });
      return res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Check-in Daten"
      });
    }
    
    // Statistiken berechnen
    const stats = {
      total_checkins: results.length,
      eingecheckt: results.filter(r => r.status === 'eingecheckt').length,
      ausgecheckt: results.filter(r => r.status === 'ausgecheckt').length,
      total_kosten: results.reduce((sum, r) => sum + (r.aktuelle_kosten || 0), 0),
      total_arbeitszeit_stunden: Math.round(results.reduce((sum, r) => sum + (r.aktuelle_arbeitszeit_minuten || 0), 0) / 60 * 10) / 10
    };
    
    res.json({
      success: true,
      checkins: results,
      stats: stats,
      datum: targetDate
    });
  });
});

// GET /api/personal-checkin/personal - Alle Personal für Check-in Dropdown
router.get("/personal", (req, res) => {
  const query = `
    SELECT 
      personal_id,
      vorname,
      nachname,
      position,
      stundenlohn,
      status
    FROM personal 
    WHERE status = 'aktiv'
    ORDER BY nachname, vorname
  `;
  
  db.query(query, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Personal-Liste:', { error: error });
      return res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Personal-Daten"
      });
    }
    
    res.json({
      success: true,
      personal: results
    });
  });
});

// POST /api/personal-checkin - Personal einchecken
router.post("/", (req, res) => {
  const { personal_id, bemerkung } = req.body;
  
  if (!personal_id) {
    return res.status(400).json({
      success: false,
      error: "Personal ID ist erforderlich"
    });
  }
  
  // Prüfen ob bereits eingecheckt heute
  const checkQuery = `
    SELECT checkin_id, status 
    FROM personal_checkin 
    WHERE personal_id = ? 
    AND DATE(checkin_time) = CURDATE() 
    AND status = 'eingecheckt'
  `;
  
  db.query(checkQuery, [personal_id], (error, existing) => {
    if (error) {
      logger.error('Fehler beim Prüfen bestehender Check-ins:', { error: error });
      return res.status(500).json({
        success: false,
        error: "Fehler beim Prüfen des Check-in Status"
      });
    }
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Personal ist bereits heute eingecheckt",
        existing_checkin_id: existing[0].checkin_id
      });
    }
    
    // Neuen Check-in erstellen
    const insertQuery = `
      INSERT INTO personal_checkin (
        personal_id, 
        checkin_time, 
        bemerkung, 
        status
      ) VALUES (?, NOW(), ?, 'eingecheckt')
    `;
    
    db.query(insertQuery, [personal_id, bemerkung || null], (error, result) => {
      if (error) {
        logger.error('Fehler beim Einchecken:', { error: error });
        return res.status(500).json({
          success: false,
          error: "Fehler beim Einchecken"
        });
      }
      
      // Den neuen Check-in mit Personal-Details zurückgeben
      const selectQuery = `
        SELECT 
          pc.*,
          p.vorname,
          p.nachname,
          p.position,
          p.stundenlohn
        FROM personal_checkin pc
        JOIN personal p ON pc.personal_id = p.personal_id
        WHERE pc.checkin_id = ?
      `;
      
      db.query(selectQuery, [result.insertId], (error, checkinData) => {
        if (error) {
          logger.error('Fehler beim Abrufen des Check-in:', { error: error });
          return res.status(500).json({
            success: false,
            error: "Check-in erstellt, aber Daten konnten nicht abgerufen werden"
          });
        }
        
        res.status(201).json({
          success: true,
          message: "Personal erfolgreich eingecheckt",
          checkin: checkinData[0]
        });
      });
    });
  });
});

// PUT /api/personal-checkin/:checkin_id/checkout - Personal auschecken
router.put("/:checkin_id/checkout", (req, res) => {
  const { checkin_id } = req.params;
  const { bemerkung } = req.body;
  
  // Check-in prüfen
  const checkQuery = `
    SELECT pc.*, p.stundenlohn
    FROM personal_checkin pc
    JOIN personal p ON pc.personal_id = p.personal_id
    WHERE pc.checkin_id = ? AND pc.status = 'eingecheckt'
  `;
  
  db.query(checkQuery, [checkin_id], (error, existing) => {
    if (error) {
      logger.error('Fehler beim Prüfen des Check-ins:', { error: error });
      return res.status(500).json({
        success: false,
        error: "Fehler beim Prüfen des Check-in Status"
      });
    }
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Check-in nicht gefunden oder bereits ausgecheckt"
      });
    }
    
    const checkin = existing[0];
    
    // Arbeitszeit und Kosten berechnen
    const updateQuery = `
      UPDATE personal_checkin 
      SET 
        checkout_time = NOW(),
        arbeitszeit_minuten = TIMESTAMPDIFF(MINUTE, checkin_time, NOW()),
        kosten = ROUND((TIMESTAMPDIFF(MINUTE, checkin_time, NOW()) / 60.0) * ?, 2),
        bemerkung = COALESCE(?, bemerkung),
        status = 'ausgecheckt',
        aktualisiert_am = NOW()
      WHERE checkin_id = ?
    `;
    
    db.query(updateQuery, [checkin.stundenlohn, bemerkung, checkin_id], (error, result) => {
      if (error) {
        logger.error('Fehler beim Auschecken:', { error: error });
        return res.status(500).json({
          success: false,
          error: "Fehler beim Auschecken"
        });
      }
      
      // Aktualisierte Daten abrufen
      const selectQuery = `
        SELECT 
          pc.*,
          p.vorname,
          p.nachname,
          p.position,
          p.stundenlohn
        FROM personal_checkin pc
        JOIN personal p ON pc.personal_id = p.personal_id
        WHERE pc.checkin_id = ?
      `;
      
      db.query(selectQuery, [checkin_id], (error, checkinData) => {
        if (error) {
          logger.error('Fehler beim Abrufen der aktualisierten Daten:', { error: error });
          return res.status(500).json({
            success: false,
            error: "Ausgecheckt, aber Daten konnten nicht abgerufen werden"
          });
        }
        
        const updatedCheckin = checkinData[0];
        
        res.json({
          success: true,
          message: `Personal ausgecheckt. Arbeitszeit: ${Math.round(updatedCheckin.arbeitszeit_minuten / 60 * 10) / 10}h, Kosten: €${updatedCheckin.kosten}`,
          checkin: updatedCheckin
        });
      });
    });
  });
});

// GET /api/personal-checkin/stats - Statistiken
router.get("/stats", (req, res) => {
  const { zeitraum } = req.query; // heute, woche, monat
  
  let dateCondition = "DATE(checkin_time) = CURDATE()";
  
  switch (zeitraum) {
    case 'woche':
      dateCondition = "YEARWEEK(checkin_time, 1) = YEARWEEK(CURDATE(), 1)";
      break;
    case 'monat':
      dateCondition = "YEAR(checkin_time) = YEAR(CURDATE()) AND MONTH(checkin_time) = MONTH(CURDATE())";
      break;
    default:
      dateCondition = "DATE(checkin_time) = CURDATE()";
  }
  
  const statsQuery = `
    SELECT 
      COUNT(*) as total_checkins,
      SUM(CASE WHEN status = 'eingecheckt' THEN 1 ELSE 0 END) as aktiv_eingecheckt,
      SUM(CASE WHEN status = 'ausgecheckt' THEN 1 ELSE 0 END) as ausgecheckt,
      SUM(COALESCE(kosten, 0)) as gesamtkosten,
      SUM(COALESCE(arbeitszeit_minuten, 0)) as gesamtarbeitszeit_minuten,
      COUNT(DISTINCT personal_id) as unterschiedliche_personal
    FROM personal_checkin
    WHERE ${dateCondition}
  `;
  
  db.query(statsQuery, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Statistiken:', { error: error });
      return res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Statistiken"
      });
    }
    
    const stats = results[0];
    stats.gesamtarbeitszeit_stunden = Math.round(stats.gesamtarbeitszeit_minuten / 60 * 10) / 10;
    
    res.json({
      success: true,
      stats: stats,
      zeitraum: zeitraum || 'heute'
    });
  });
});

// DELETE /api/personal-checkin/:checkin_id - Check-in löschen (nur Admin)
router.delete("/:checkin_id", (req, res) => {
  const { checkin_id } = req.params;
  
  const deleteQuery = "DELETE FROM personal_checkin WHERE checkin_id = ?";
  
  db.query(deleteQuery, [checkin_id], (error, result) => {
    if (error) {
      logger.error('Fehler beim Löschen des Check-ins:', { error: error });
      return res.status(500).json({
        success: false,
        error: "Fehler beim Löschen des Check-ins"
      });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Check-in nicht gefunden"
      });
    }
    
    res.json({
      success: true,
      message: "Check-in erfolgreich gelöscht"
    });
  });
});

module.exports = router;