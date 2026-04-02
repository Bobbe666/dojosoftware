-- Migration: Raum-ID zu Stundenplan hinzufügen
-- Datum: 2025-01-12

-- Füge raum_id Spalte zur stundenplan Tabelle hinzu
ALTER TABLE stundenplan
ADD COLUMN raum_id INT NULL,
ADD CONSTRAINT fk_stundenplan_raum
    FOREIGN KEY (raum_id) REFERENCES raeume(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Index für bessere Performance
CREATE INDEX idx_stundenplan_raum ON stundenplan(raum_id);

-- Kommentar hinzufügen
ALTER TABLE stundenplan
MODIFY COLUMN raum_id INT NULL COMMENT 'Zugeordneter Raum für diesen Stundenplan-Eintrag';


