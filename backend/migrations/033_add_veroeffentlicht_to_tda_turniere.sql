-- ============================================================================
-- TDA TURNIERE - VEROEFFENTLICHT SPALTE HINZUFUEGEN
-- Datum: 2026-02-12
-- Beschreibung: Fuegt veroeffentlicht Spalte hinzu fuer Sichtbarkeit in Dojo Software
-- ============================================================================

-- Spalte veroeffentlicht hinzufuegen (wenn nicht existiert)
ALTER TABLE tda_turniere
ADD COLUMN IF NOT EXISTS veroeffentlicht TINYINT(1) DEFAULT 1 COMMENT 'Ob Turnier in Dojo/Verband Software sichtbar ist'
AFTER status;

-- Index fuer Filterung
CREATE INDEX IF NOT EXISTS idx_veroeffentlicht ON tda_turniere(veroeffentlicht);
