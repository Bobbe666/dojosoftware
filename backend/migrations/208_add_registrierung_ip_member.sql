-- Registrierungs-IP + Browser für Member-App-Selbstregistrierung (Tabelle registrierungen)
-- Sicherheit/Missbrauchsschutz, Art. 6 Abs. 1 lit. f DSGVO. Auf Prod bereits angewandt (2026-06-17).
ALTER TABLE registrierungen
  ADD COLUMN IF NOT EXISTS registrierung_ip VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS registrierung_user_agent VARCHAR(500) NULL;
