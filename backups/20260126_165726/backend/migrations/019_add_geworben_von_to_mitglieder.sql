-- Mitglieder-Tabelle um Werber-Referenz erweitern
ALTER TABLE mitglieder
  ADD COLUMN geworben_von_mitglied_id INT NULL;

CREATE INDEX idx_mitglieder_geworben_von
  ON mitglieder (geworben_von_mitglied_id);


