-- Dojo Logos Table
-- Speichert bis zu 5 Logos pro Dojo

CREATE TABLE IF NOT EXISTS dojo_logos (
  logo_id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  logo_type ENUM('haupt', 'alternativ', 'partner1', 'partner2', 'social') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL COMMENT 'Größe in Bytes',
  mime_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_by INT,

  FOREIGN KEY (dojo_id) REFERENCES dojos(dojo_id) ON DELETE CASCADE,
  UNIQUE KEY unique_dojo_logo (dojo_id, logo_type),
  INDEX idx_dojo_id (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
