-- ============================================================================
-- TDA TURNIERE INTEGRATION - DATENBANKTABELLE
-- Datum: 2026-01-14
-- Beschreibung: Speichert Turnier-Daten die von TDA Software synchronisiert werden
-- ============================================================================

-- TDA Turniere Haupttabelle
CREATE TABLE IF NOT EXISTS tda_turniere (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tda_turnier_id INT NOT NULL UNIQUE COMMENT 'Original ID aus TDA Software',
  name VARCHAR(200) NOT NULL,
  datum DATE NOT NULL,
  datum_ende DATE NULL COMMENT 'Für mehrtägige Turniere',
  ort VARCHAR(200),
  adresse VARCHAR(300),
  disziplin VARCHAR(100),
  anmeldeschluss DATE,
  status VARCHAR(50) DEFAULT 'Aktiv',
  beschreibung TEXT,
  max_teilnehmer INT,
  teilnahmegebuehr DECIMAL(10,2),
  tda_registration_url VARCHAR(500) COMMENT 'URL zur Turnier-Anmeldung in TDA',
  veranstalter VARCHAR(200),
  kontakt_email VARCHAR(100),
  kontakt_telefon VARCHAR(50),
  altersklassen TEXT COMMENT 'Komma-getrennte Liste der Altersklassen',
  gewichtsklassen TEXT COMMENT 'Komma-getrennte Liste der Gewichtsklassen',
  bild_url VARCHAR(500),
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Letzter Sync-Zeitpunkt',
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_datum (datum),
  INDEX idx_status (status),
  INDEX idx_disziplin (disziplin),
  INDEX idx_anmeldeschluss (anmeldeschluss)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- BEISPIEL-DATEN (Optional - kann nach dem Test entfernt werden)
-- ============================================================================
-- INSERT INTO tda_turniere (
--   tda_turnier_id, name, datum, ort, disziplin, anmeldeschluss,
--   status, beschreibung, max_teilnehmer, teilnahmegebuehr, tda_registration_url
-- ) VALUES (
--   1,
--   'TDA Frühjahrsturnier 2026',
--   '2026-04-15',
--   'Sporthalle Musterstadt',
--   'Taekwondo Vollkontakt',
--   '2026-04-01',
--   'Aktiv',
--   'Das große TDA Frühjahrsturnier mit allen Alters- und Gewichtsklassen.',
--   200,
--   35.00,
--   'https://events.tda-intl.org/turnier/1/anmelden'
-- );
