-- Registrierungs-Metadaten (IP + Browser) für Verbandsmitgliedschaften
-- Zweck: Sicherheit / Missbrauchsschutz (Registrierungen unter fremdem Namen nachvollziehbar machen).
-- Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO. Bereits live auf Prod angewandt (2026-06-17).
ALTER TABLE verbandsmitgliedschaften
  ADD COLUMN IF NOT EXISTS registrierung_ip VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS registrierung_user_agent VARCHAR(500) NULL;
