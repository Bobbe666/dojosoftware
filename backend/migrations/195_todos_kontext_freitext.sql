-- ============================================================================
-- 195: To-Do-Kontext von ENUM auf Freitext
-- Erlaubt zusätzliche Bereiche (dojosoftware) und event-spezifische Kontexte
-- ("Event: <Titel>" aus Auto-Checklisten & Quick-Add). Bestehende Werte bleiben.
-- ============================================================================

ALTER TABLE todos
  MODIFY COLUMN kontext VARCHAR(80) NOT NULL DEFAULT 'allgemein';
