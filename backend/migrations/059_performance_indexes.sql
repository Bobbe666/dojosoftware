-- Performance-Indizes für häufige WHERE-Klauseln
-- Migration 059 — 2026-03-21

-- mitglieder: häufigste Filter
ALTER TABLE mitglieder ADD INDEX IF NOT EXISTS idx_aktiv (aktiv);
ALTER TABLE mitglieder ADD INDEX IF NOT EXISTS idx_dojo_id (dojo_id);
ALTER TABLE mitglieder ADD INDEX IF NOT EXISTS idx_eintrittsdatum (eintrittsdatum);
ALTER TABLE mitglieder ADD INDEX IF NOT EXISTS idx_email (email);
ALTER TABLE mitglieder ADD INDEX IF NOT EXISTS idx_dojo_aktiv (dojo_id, aktiv);

-- vertraege: häufigste Filter
ALTER TABLE vertraege ADD INDEX IF NOT EXISTS idx_status (status);
ALTER TABLE vertraege ADD INDEX IF NOT EXISTS idx_tarif_id (tarif_id);
ALTER TABLE vertraege ADD INDEX IF NOT EXISTS idx_mitglied_id (mitglied_id);

-- checkins: häufig nach dojo_id und datum gefiltert
ALTER TABLE checkins ADD INDEX IF NOT EXISTS idx_dojo_id (dojo_id);
ALTER TABLE checkins ADD INDEX IF NOT EXISTS idx_checkin_zeit (checkin_zeit);

-- anwesenheit: nach mitglied_id und datum
ALTER TABLE anwesenheit ADD INDEX IF NOT EXISTS idx_mitglied_id (mitglied_id);
ALTER TABLE anwesenheit ADD INDEX IF NOT EXISTS idx_datum (datum);

-- beitraege: nach mitglied_id und status
ALTER TABLE beitraege ADD INDEX IF NOT EXISTS idx_mitglied_id (mitglied_id);
ALTER TABLE beitraege ADD INDEX IF NOT EXISTS idx_status (status);
