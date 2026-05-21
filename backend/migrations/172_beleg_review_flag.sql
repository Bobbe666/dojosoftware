-- Migration 172: Belege rot markieren (review_needed + Kommentar)
ALTER TABLE buchhaltung_belege
  ADD COLUMN IF NOT EXISTS review_needed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_kommentar TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_beleg_review ON buchhaltung_belege(dojo_id, review_needed);
