-- Migration 084: Zahlungsstatus und erweiterte Zahlungsarten für Verkäufe
-- Behebt: POST /api/verkaeufe gibt 400 zurück weil zahlungsstatus-Spalte fehlt
--         und zahlungsart ENUM 'lastschrift'/'sumup' nicht enthält

-- zahlungsstatus Spalte hinzufügen
ALTER TABLE verkaeufe
  ADD COLUMN IF NOT EXISTS zahlungsstatus ENUM('offen', 'bezahlt') NOT NULL DEFAULT 'bezahlt'
  AFTER zahlungsart;

-- Bestehende Lastschrift-Verkäufe rückwirkend als 'offen' markieren
UPDATE verkaeufe SET zahlungsstatus = 'offen' WHERE zahlungsart = 'digital';

-- zahlungsart ENUM um 'lastschrift' und 'sumup' erweitern
ALTER TABLE verkaeufe
  MODIFY COLUMN zahlungsart ENUM('bar', 'karte', 'digital', 'lastschrift', 'sumup', 'gutschein') NOT NULL DEFAULT 'bar';
