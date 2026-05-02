-- Migration 147: Bundesland + Ferien-Modus für Dojos
ALTER TABLE dojo
  ADD COLUMN IF NOT EXISTS bundesland VARCHAR(5)  NULL    COMMENT 'Bundesland-Code z.B. BY, BW, NW',
  ADD COLUMN IF NOT EXISTS ferien_modus ENUM('bundesland','alle') NOT NULL DEFAULT 'bundesland'
    COMMENT 'Ferien-Anzeige: nur eigenes Bundesland oder alle';
