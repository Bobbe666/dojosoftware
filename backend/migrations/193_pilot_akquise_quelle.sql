-- ============================================================================
-- 193: Pilot-Bewerbungen als Akquise-Quelle
-- Neue Bewerbungen werden automatisch als Akquise-Kontakt angelegt (heißer Lead).
-- ============================================================================

ALTER TABLE akquise_kontakte
  MODIFY COLUMN quelle ENUM('manuell','tda_events','empfehlung','messe','internet','trial','pilot','sonstige')
  DEFAULT 'manuell';
