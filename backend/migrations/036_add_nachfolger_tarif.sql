-- Migration: Nachfolger-Tarif für archivierte Tarife
-- Ermöglicht die Zuordnung eines Nachfolge-Tarifs zu archivierten Tarifen
-- für automatische Preisanzeige bei Tariferhöhungen

-- Nachfolger-Tarif Feld hinzufügen
ALTER TABLE tarife
ADD COLUMN IF NOT EXISTS nachfolger_tarif_id INT DEFAULT NULL
  COMMENT 'ID des Nachfolge-Tarifs für archivierte Tarife';

-- Foreign Key Constraint
ALTER TABLE tarife
ADD CONSTRAINT fk_tarife_nachfolger
  FOREIGN KEY (nachfolger_tarif_id) REFERENCES tarife(id)
  ON DELETE SET NULL;

-- Index für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_tarife_nachfolger ON tarife(nachfolger_tarif_id);
