-- Migration: Create software_lizenzen table
-- Für die EÜR-Berechnung der TDA Software-Einnahmen (Dojo-Abos)

CREATE TABLE IF NOT EXISTS software_lizenzen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  lizenz_typ ENUM('basic', 'professional', 'enterprise') NOT NULL DEFAULT 'basic',
  betrag DECIMAL(10,2) NOT NULL,
  zahlungsintervall ENUM('monatlich', 'quartalsweise', 'jaehrlich') NOT NULL DEFAULT 'monatlich',
  status ENUM('aktiv', 'gekuendigt', 'pausiert', 'ausstehend', 'bezahlt') NOT NULL DEFAULT 'aktiv',
  bezahlt_am DATE NULL,
  faellig_am DATE NULL,
  rechnungsnummer VARCHAR(50) NULL,
  zeitraum_von DATE NULL,
  zeitraum_bis DATE NULL,
  notizen TEXT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_dojo_id (dojo_id),
  INDEX idx_status (status),
  INDEX idx_bezahlt_am (bezahlt_am),
  INDEX idx_faellig_am (faellig_am),

  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kommentar zur Tabelle
ALTER TABLE software_lizenzen COMMENT = 'Tracking der Software-Lizenzgebühren für Dojos (SaaS-Abonnements)';
