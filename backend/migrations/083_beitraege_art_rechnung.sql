-- Migration 083: beitraege strukturieren mit Typ (art) und Rechnungsverknüpfung
-- Zweck: Saubere Trennung von Monatsbeiträgen, Prüfungsgebühren, Artikeln etc.
--        damit der Lastschriftlauf nie versehentlich falsche Positionen einzieht.

ALTER TABLE beitraege
  ADD COLUMN art ENUM('mitgliedsbeitrag','pruefungsgebuehr','kursgebuehr','artikel','aufnahmegebuehr','sonstiges')
    NOT NULL DEFAULT 'mitgliedsbeitrag'
    AFTER magicline_description,
  ADD COLUMN rechnung_id INT NULL
    AFTER art,
  ADD CONSTRAINT fk_beitraege_rechnung
    FOREIGN KEY (rechnung_id) REFERENCES rechnungen(rechnung_id) ON DELETE SET NULL;

-- Index für schnelle Abfragen nach Art
CREATE INDEX idx_beitraege_art ON beitraege(art);
CREATE INDEX idx_beitraege_rechnung_id ON beitraege(rechnung_id);
