// routes/migration.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

// Migration für rechtliche Felder
router.post('/rechtliche-felder', (req, res) => {
  const migrationSQL = `
    -- Rechtliche Texte hinzufügen
    ALTER TABLE dojo 
    ADD COLUMN IF NOT EXISTS agb_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS dsgvo_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS dojo_regeln_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS hausordnung_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS widerrufsbelehrung_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS impressum_text TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS vertragsbedingungen_text TEXT DEFAULT NULL;
  `;
  
  db.query(migrationSQL, (err, results) => {
    if (err) {
      logger.error('Migration Fehler:', { error: err });
      return res.status(500).json({ 
        error: 'Migration fehlgeschlagen', 
        details: err.message 
      });
    }
    res.json({ 
      success: true, 
      message: 'Rechtliche Felder erfolgreich hinzugefügt',
      results: results
    });
  });
});

// Migration für alle erweiterten Felder
router.post('/alle-felder', (req, res) => {
  const migrations = [
    // Rechtliche Texte
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS agb_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS dsgvo_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS dojo_regeln_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS hausordnung_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS widerrufsbelehrung_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS impressum_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vertragsbedingungen_text TEXT DEFAULT NULL;`,
    
    // Erweiterte Grunddaten
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS untertitel VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vertreter VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS gruendungsjahr VARCHAR(10) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS land VARCHAR(100) DEFAULT 'Deutschland';`,
    
    // Kontakt erweitert
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS fax VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS email_info VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS email_anmeldung VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS whatsapp_nummer VARCHAR(50) DEFAULT NULL;`,
    
    // Steuerliches
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS steuernummer VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS umsatzsteuer_id VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS finanzamt VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS steuerberater VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS steuerberater_telefon VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS umsatzsteuerpflichtig BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS kleinunternehmer BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS gemeinnuetzig BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS freistellungsbescheid_datum DATE DEFAULT NULL;`,
    
    // Rechtliches
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS rechtsform VARCHAR(100) DEFAULT 'Verein',
     ADD COLUMN IF NOT EXISTS vereinsregister_nr VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS amtsgericht VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS handelsregister_nr VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS geschaeftsfuehrer VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vorstand_1_vorsitzender VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vorstand_2_vorsitzender VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vorstand_kassenwart VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vorstand_schriftfuehrer VARCHAR(255) DEFAULT NULL;`,
    
    // Bank
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS bank_iban VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS bank_bic VARCHAR(20) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS bank_inhaber VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS bank_verwendungszweck VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS sepa_glaeubiger_id VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS lastschrift_aktiv BOOLEAN DEFAULT FALSE;`,
    
    // Versicherungen
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS haftpflicht_versicherung VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS haftpflicht_police_nr VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS haftpflicht_ablauf DATE DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS unfallversicherung VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS unfallversicherung_police_nr VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS gebaeudeversicherung VARCHAR(255) DEFAULT NULL;`,
    
    // Verträge
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS kuendigungsfrist_monate INT DEFAULT 3,
     ADD COLUMN IF NOT EXISTS mindestlaufzeit_monate INT DEFAULT 12,
     ADD COLUMN IF NOT EXISTS probezeit_tage INT DEFAULT 14,
     ADD COLUMN IF NOT EXISTS vertrag_kuendigung_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vertrag_mindestlaufzeit_text TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS vertrag_probezeit_text TEXT DEFAULT NULL;`,
    
    // Sport & Verband
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS verband_name VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_mitgliedsnummer VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_ansprechpartner VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_telefon VARCHAR(50) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_email VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_website VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_beitrag_jaehrlich DECIMAL(10,2) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_beitrag_bezahlt BOOLEAN DEFAULT FALSE,
     ADD COLUMN IF NOT EXISTS verband_beitrag_faellig DATE DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_lizenz_gueltig DATE DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_lizenz_nummer VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_ansprechpartner_2 VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS verband_ansprechpartner_3 VARCHAR(255) DEFAULT NULL;`,
    
    // Öffnungszeiten
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_mo VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_di VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_mi VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_do VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_fr VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_sa VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_so VARCHAR(100) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_feiertage TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_sommerpause_start DATE DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_sommerpause_ende DATE DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS oeffnungszeiten_ferienregelung TEXT DEFAULT NULL;`,
    
    // System
    `ALTER TABLE dojo 
     ADD COLUMN IF NOT EXISTS theme_scheme VARCHAR(50) DEFAULT 'default',
     ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS dsgvo_beauftragte VARCHAR(255) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS max_mitglieder INT DEFAULT 500;`
  ];
  
  let completedMigrations = 0;
  let errors = [];
  
  migrations.forEach((sql, index) => {
    db.query(sql, (err, results) => {
      if (err) {
        logger.error('Migration ${index + 1} Fehler:', { error: err.message });
        errors.push(`Migration ${index + 1}: ${err.message}`);
      } else {
        completedMigrations++;
      }
      
      // Alle Migrationen abgeschlossen
      if (completedMigrations + errors.length === migrations.length) {
        if (errors.length === 0) {
          res.json({ 
            success: true, 
            message: 'Alle Migrationen erfolgreich abgeschlossen',
            completed: completedMigrations,
            total: migrations.length
          });
        } else {
          res.status(500).json({ 
            success: false,
            message: 'Migrationen mit Fehlern abgeschlossen',
            completed: completedMigrations,
            errors: errors,
            total: migrations.length
          });
        }
      }
    });
  });
});

// Tabellen-Struktur anzeigen
router.get('/dojo-structure', (req, res) => {
  const sql = `DESCRIBE dojo`;
  db.query(sql, (err, results) => {
    if (err) {
      logger.error('Fehler beim Abrufen der Tabellen-Struktur:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Abrufen der Tabellen-Struktur' });
    }
    res.json({
      success: true,
      columns: results,
      total: results.length
    });
  });
});

module.exports = router;
