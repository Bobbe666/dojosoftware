-- Migration 136: Gutschriften (Credits) pro Mitglied
-- Ermöglicht manuelle Gutschriften, die automatisch mit dem nächsten Lastschriftlauf verrechnet werden

CREATE TABLE IF NOT EXISTS mitglied_gutschriften (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mitglied_id INT NOT NULL,
  dojo_id INT NOT NULL,
  betrag DECIMAL(10,2) NOT NULL,
  restbetrag DECIMAL(10,2) NOT NULL,
  grund TEXT,
  erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
  erstellt_von INT DEFAULT NULL,
  verrechnet TINYINT(1) DEFAULT 0,
  verrechnet_am DATETIME DEFAULT NULL,
  verrechnet_beitrag_ids JSON DEFAULT NULL,
  stripe_transaktion_id INT DEFAULT NULL,
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_offen (verrechnet, dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
