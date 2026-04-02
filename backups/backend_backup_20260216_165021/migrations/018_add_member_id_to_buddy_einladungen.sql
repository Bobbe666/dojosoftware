-- Buddy-Einladungen um finale Mitglieds-ID erweitern
ALTER TABLE buddy_einladungen
  ADD COLUMN mitglied_id INT NULL;

-- Optional: Index für schnelle Attribution
CREATE INDEX idx_buddy_einladungen_mitglied_id
  ON buddy_einladungen (mitglied_id);


