-- Migration 177: Performance-Indizes für häufig abgefragte Spalten-Kombinationen

-- mitglied_ratenplan: Composite für "aktive Ratenpläne eines Mitglieds"
CREATE INDEX IF NOT EXISTS idx_mitglied_ratenplan_mitglied_aktiv
  ON mitglied_ratenplan(mitglied_id, aktiv);

-- rechnungen: Häufige Filter-Kombinationen
CREATE INDEX IF NOT EXISTS idx_rechnungen_mitglied_status
  ON rechnungen(mitglied_id, status);

CREATE INDEX IF NOT EXISTS idx_rechnungen_erstellt_am
  ON rechnungen(erstellt_am);

-- pruefungen: Kandidaten-Queries (mitglied + stil + status)
CREATE INDEX IF NOT EXISTS idx_pruefungen_mitglied_stil_status
  ON pruefungen(mitglied_id, stil_id, status);

-- stripe_lastschrift_transaktion: Dojo + Status-Filter
CREATE INDEX IF NOT EXISTS idx_stripe_transaktion_mitglied_status
  ON stripe_lastschrift_transaktion(mitglied_id, status);

-- stripe_lastschrift_batch: Dojo + Status
CREATE INDEX IF NOT EXISTS idx_stripe_batch_dojo_status
  ON stripe_lastschrift_batch(dojo_id, status);

-- rechnung_aktionen: Sort nach Zeit pro Rechnung
CREATE INDEX IF NOT EXISTS idx_rechnung_aktionen_rechnung_zeit
  ON rechnung_aktionen(rechnung_id, erstellt_am);
