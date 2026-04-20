-- Migration 085: artikel_id in verkauf_positionen nullable machen
-- Behebt: Nachlass/Rabatt-Positionen haben artikel_id = NULL → ER_BAD_NULL_ERROR

-- Erst FOREIGN KEY Constraint entfernen (verhindert nullable)
ALTER TABLE verkauf_positionen
  DROP FOREIGN KEY IF EXISTS verkauf_positionen_ibfk_1;

-- Alle FK-Namen finden und ggf. entfernen (Name kann variieren)
SET @fk_name = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'verkauf_positionen'
    AND COLUMN_NAME = 'artikel_id' AND REFERENCED_TABLE_NAME = 'artikel'
  LIMIT 1
);
SET @sql = IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE verkauf_positionen DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Spalte nullable machen
ALTER TABLE verkauf_positionen
  MODIFY COLUMN artikel_id INT NULL;

-- FK neu anlegen mit ON DELETE SET NULL
ALTER TABLE verkauf_positionen
  ADD CONSTRAINT fk_vp_artikel FOREIGN KEY (artikel_id) REFERENCES artikel(artikel_id) ON DELETE SET NULL;
