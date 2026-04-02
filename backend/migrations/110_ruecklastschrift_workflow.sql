-- ============================================================================
-- Migration 110: Rücklastschrift-Workflow
-- Erweitert offene_zahlungen für Mahnungs-Tracking
-- Neue Tabelle: mitglied_nachrichten (für Memberboard-Hinweise)
-- ============================================================================

-- Spalten für Rücklastschrift-Mahnungs-Workflow in offene_zahlungen
ALTER TABLE offene_zahlungen
  ADD COLUMN IF NOT EXISTS mahnung_1_datum DATE NULL,
  ADD COLUMN IF NOT EXISTS mahnung_2_datum DATE NULL,
  ADD COLUMN IF NOT EXISTS mahnbescheid_datum DATE NULL,
  ADD COLUMN IF NOT EXISTS rueckgabe_code VARCHAR(10) NULL,
  ADD COLUMN IF NOT EXISTS massnahme ENUM('nochmal_abbuchen','rechnung_gestellt','mahnbescheid','abgeschrieben') NULL;

-- Mitglied-Nachrichten für Memberboard
-- Wird bei Rücklastschrift-Mahnungen befüllt und im Member-Dashboard angezeigt
CREATE TABLE IF NOT EXISTS mitglied_nachrichten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  dojo_id INT NOT NULL,
  typ ENUM('zahlungshinweis', 'mahnung', 'info') NOT NULL DEFAULT 'info',
  titel VARCHAR(255) NOT NULL,
  nachricht TEXT NOT NULL,
  gelesen TINYINT DEFAULT 0,
  referenz_id INT NULL COMMENT 'offene_zahlungen.id',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_dojo_mitglied (dojo_id, mitglied_id),
  INDEX idx_ungelesen (mitglied_id, gelesen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
