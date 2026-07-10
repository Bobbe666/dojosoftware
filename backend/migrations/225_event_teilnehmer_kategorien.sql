-- Migration 225: Mehr-Personen-Anmeldung mit Kategorien (Erwachsener/Kind) pro Event
-- Ein Event, zwei Preis-Stufen: teilnahmegebuehr = Erwachsener, preis_kind = Kind.
-- Pro Anmeldung/Gast eine Teilnehmer-Liste (JSON) + berechneter Gesamtbetrag.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS preis_kind DECIMAL(10,2) NULL;

ALTER TABLE event_anmeldungen
  ADD COLUMN IF NOT EXISTS teilnehmer JSON NULL,
  ADD COLUMN IF NOT EXISTS gesamt_betrag DECIMAL(10,2) NULL;

ALTER TABLE event_gaeste
  ADD COLUMN IF NOT EXISTS teilnehmer JSON NULL,
  ADD COLUMN IF NOT EXISTS gesamt_betrag DECIMAL(10,2) NULL;
