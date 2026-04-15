-- ============================================================================
-- Migration 124: Nationalkader
-- Speichert Kader-Definitionen und Nominierungen basierend auf TDA-Events-Ergebnissen
-- ============================================================================

CREATE TABLE IF NOT EXISTS nationalkader (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bezeichnung VARCHAR(255) NOT NULL COMMENT 'z.B. Nationalkader 2025',
  saison VARCHAR(20) NOT NULL COMMENT 'z.B. 2025 oder 2025/2026',
  sportart VARCHAR(100) COMMENT 'z.B. karate, taekwondo, kickboxing',
  beschreibung TEXT,
  aktiv TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nationalkader_nominierungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kader_id INT NOT NULL,
  -- Athleten-Daten (von TDA-Events, denormalisiert für Resilienz)
  events_wettkaempfer_id INT NOT NULL,
  vorname VARCHAR(100) NOT NULL,
  nachname VARCHAR(100) NOT NULL,
  geschlecht VARCHAR(20),
  geburtsdatum DATE,
  verein_name VARCHAR(255),
  -- Nominierungsdetails
  nominierungsart ENUM('automatisch', 'manuell') DEFAULT 'automatisch',
  nominiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  nominiert_durch_user_id INT,
  -- Turnierergebnis (Referenz, nullable bei manueller Nominierung)
  events_turnier_id INT,
  turnier_name VARCHAR(255),
  turnier_datum DATE,
  division_name VARCHAR(255),
  division_code VARCHAR(100),
  platzierung TINYINT COMMENT '1, 2 oder 3',
  -- Status & Notiz
  status ENUM('aktiv', 'inaktiv', 'gesperrt') DEFAULT 'aktiv',
  notiz TEXT,
  FOREIGN KEY (kader_id) REFERENCES nationalkader(id) ON DELETE CASCADE,
  -- Verhindert Duplikate: gleicher Athlet kann nicht zweimal für dasselbe Turnier+Division nominiert werden
  UNIQUE KEY unique_nominierung (kader_id, events_wettkaempfer_id, events_turnier_id, division_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_nationalkader_aktiv ON nationalkader(aktiv);
CREATE INDEX idx_nominierungen_kader ON nationalkader_nominierungen(kader_id);
CREATE INDEX idx_nominierungen_athlet ON nationalkader_nominierungen(events_wettkaempfer_id);
CREATE INDEX idx_nominierungen_status ON nationalkader_nominierungen(status);
