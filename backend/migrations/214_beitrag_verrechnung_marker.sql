-- Migration: Beitrag -> 10er-Karten-Verrechnungs-Marker
-- Erstellt: 2026-06-24
-- Beschreibung: Markiert einen bezahlten Mitgliedsbeitrag, der bei einem
--   10er-Karten-Kauf (Ruhepause-Verrechnung) angerechnet wurde. Verhindert
--   Doppel-Anrechnung desselben Beitrags bei einem weiteren Kartenkauf.

ALTER TABLE beitraege
    ADD COLUMN IF NOT EXISTS verrechnet_zehnerkarte_id INT DEFAULT NULL;
