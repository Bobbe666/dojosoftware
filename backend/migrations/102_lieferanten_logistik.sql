ALTER TABLE lieferanten
  ADD COLUMN IF NOT EXISTS incoterms    VARCHAR(5)   AFTER ursprungsland,
  ADD COLUMN IF NOT EXISTS transportweg VARCHAR(30)  AFTER incoterms,
  ADD COLUMN IF NOT EXISTS spediteur    VARCHAR(100) AFTER transportweg,
  ADD COLUMN IF NOT EXISTS zollagent    VARCHAR(100) AFTER spediteur;
