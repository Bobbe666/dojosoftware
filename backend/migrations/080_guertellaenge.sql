-- Migration 080: Gürtellänge pro Mitglied pro Stil
-- Speichert die individuelle Gürtellänge in cm (z.B. 220, 240, ..., 340)

ALTER TABLE mitglied_stil_data
  ADD COLUMN guertellaenge_cm SMALLINT UNSIGNED NULL DEFAULT NULL
  COMMENT 'Gürtellänge in cm (z.B. 220, 240, 260, 280, 300, 320, 340)';
