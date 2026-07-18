-- Revisionssicheres E-Mail-Archiv (GoBD-Richtung):
--  1) Hash-Verkettung: prev_hash (= record_hash der Vorzeile) + record_hash (= SHA256(prev_hash + inhalt_hash))
--     → nachträgliches Löschen/Ändern/Umsortieren bricht die Kette und ist nachweisbar.
--  2) Append-only: BEFORE UPDATE/DELETE-Trigger verhindern jede Änderung/Löschung (WORM).
--     Für Ausnahmefälle (z.B. DSGVO-Löschauftrag) muss ein DBA den Trigger kurz droppen.

ALTER TABLE dojo_email_archive
  ADD COLUMN IF NOT EXISTS prev_hash   CHAR(64) NULL AFTER inhalt_hash,
  ADD COLUMN IF NOT EXISTS record_hash CHAR(64) NULL AFTER prev_hash;

DROP TRIGGER IF EXISTS trg_dea_no_update;
DROP TRIGGER IF EXISTS trg_dea_no_delete;

CREATE TRIGGER trg_dea_no_update BEFORE UPDATE ON dojo_email_archive
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'E-Mail-Archiv ist revisionssicher (append-only) - UPDATE nicht erlaubt';

CREATE TRIGGER trg_dea_no_delete BEFORE DELETE ON dojo_email_archive
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'E-Mail-Archiv ist revisionssicher (append-only) - DELETE nicht erlaubt';
