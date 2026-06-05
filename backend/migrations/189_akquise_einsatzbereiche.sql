-- 189: Akquise-Kontakte → zentrale Kontaktdatenbank mit Einsatzbereichen
-- Kontakte stehen nicht mehr nur der Dojosoftware-Akquise zur Verfügung,
-- sondern allen Bereichen: Dojosoftware, Events/Turniere, Verband, Veranstaltungen/Seminare.
-- Komma-separierte Liste, Filterung via FIND_IN_SET.

ALTER TABLE akquise_kontakte
  ADD COLUMN einsatzbereiche VARCHAR(255) NOT NULL DEFAULT 'dojosoftware'
  AFTER quelle;

-- Bestand: alle bisherigen Kontakte für alle Bereiche freischalten
UPDATE akquise_kontakte
SET einsatzbereiche = 'dojosoftware,events,verband,veranstaltungen';
