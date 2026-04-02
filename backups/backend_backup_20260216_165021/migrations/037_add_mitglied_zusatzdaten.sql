-- Migration: Mitglied Zusatzdaten (Lehrgänge, Ehrungen, Zertifikate)
-- Datum: 2026-01-21

-- Tabelle für Zusatzdaten (Lehrgänge, Ehrungen, Zertifikate, etc.)
CREATE TABLE IF NOT EXISTS mitglied_zusatzdaten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  dojo_id INT NOT NULL,
  typ ENUM('Lehrgang', 'Ehrung', 'Zertifikat', 'Auszeichnung', 'Sonstiges') NOT NULL DEFAULT 'Sonstiges',
  bezeichnung VARCHAR(255) NOT NULL COMMENT 'Name des Lehrgangs/der Ehrung',
  datum DATE NULL COMMENT 'Datum des Ereignisses',
  datum_bis DATE NULL COMMENT 'End-Datum (bei mehrtägigen Lehrgängen)',
  ort VARCHAR(255) NULL COMMENT 'Veranstaltungsort',
  beschreibung TEXT NULL COMMENT 'Zusätzliche Beschreibung',
  aussteller VARCHAR(255) NULL COMMENT 'Ausstellende Organisation/Person',
  dokument_pfad VARCHAR(500) NULL COMMENT 'Pfad zum hochgeladenen Dokument/Zertifikat',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  erstellt_von INT NULL COMMENT 'User-ID des Erstellers',
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_typ (typ),
  INDEX idx_datum (datum),
  
  FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feld für historische Prüfungen hinzufügen
ALTER TABLE pruefungen
ADD COLUMN IF NOT EXISTS ist_historisch BOOLEAN DEFAULT FALSE COMMENT 'Historische Prüfung (vor Systemeinführung)',
ADD COLUMN IF NOT EXISTS historisch_bemerkung VARCHAR(500) NULL COMMENT 'Bemerkung zur historischen Prüfung';

-- Feld für Zahlungsstatus bei Prüfungen hinzufügen (falls nicht vorhanden)
ALTER TABLE pruefungen
ADD COLUMN IF NOT EXISTS gebuehr_bezahlt BOOLEAN DEFAULT FALSE COMMENT 'Prüfungsgebühr bezahlt',
ADD COLUMN IF NOT EXISTS gebuehr_bezahlt_am DATE NULL COMMENT 'Datum der Zahlung',
ADD COLUMN IF NOT EXISTS gebuehr_betrag DECIMAL(10,2) NULL COMMENT 'Gezahlter Betrag';

-- Index für Zahlungsstatus
CREATE INDEX IF NOT EXISTS idx_pruefungen_bezahlt ON pruefungen(gebuehr_bezahlt);
