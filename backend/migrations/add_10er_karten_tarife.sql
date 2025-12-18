-- =====================================================================================
-- 10ER-KARTEN TARIFE HINZUFÜGEN
-- =====================================================================================
-- Fügt 3 neue Tarife für 10er-Karten hinzu
-- =====================================================================================

-- 10er Karte Kids - 120 EUR, 6 Monate gültig
INSERT INTO tarife (
  name,
  price_cents,
  aufnahmegebuehr_cents,
  currency,
  duration_months,
  billing_cycle,
  payment_method,
  active,
  altersgruppe,
  mindestlaufzeit_monate,
  kuendigungsfrist_monate
) VALUES (
  '10er Karte Kids',
  12000,  -- 120 EUR
  0,      -- Keine Aufnahmegebühr
  'EUR',
  6,      -- 6 Monate gültig
  'MONTHLY',  -- Dummy-Wert (wird nicht für Abrechnung verwendet)
  'BANK_TRANSFER',
  1,
  'Kinder',
  0,      -- Keine Mindestlaufzeit
  0       -- Keine Kündigungsfrist
);

-- 10er Karte Schüler - 120 EUR, 6 Monate gültig
INSERT INTO tarife (
  name,
  price_cents,
  aufnahmegebuehr_cents,
  currency,
  duration_months,
  billing_cycle,
  payment_method,
  active,
  altersgruppe,
  mindestlaufzeit_monate,
  kuendigungsfrist_monate
) VALUES (
  '10er Karte Schüler',
  12000,  -- 120 EUR
  0,      -- Keine Aufnahmegebühr
  'EUR',
  6,      -- 6 Monate gültig
  'MONTHLY',  -- Dummy-Wert (wird nicht für Abrechnung verwendet)
  'BANK_TRANSFER',
  1,
  'Schüler',
  0,      -- Keine Mindestlaufzeit
  0       -- Keine Kündigungsfrist
);

-- 10er Karte Erwachsene - 160 EUR, 6 Monate gültig
INSERT INTO tarife (
  name,
  price_cents,
  aufnahmegebuehr_cents,
  currency,
  duration_months,
  billing_cycle,
  payment_method,
  active,
  altersgruppe,
  mindestlaufzeit_monate,
  kuendigungsfrist_monate
) VALUES (
  '10er Karte Erwachsene',
  16000,  -- 160 EUR
  0,      -- Keine Aufnahmegebühr
  'EUR',
  6,      -- 6 Monate gültig
  'MONTHLY',  -- Dummy-Wert (wird nicht für Abrechnung verwendet)
  'BANK_TRANSFER',
  1,
  'Erwachsene',
  0,      -- Keine Mindestlaufzeit
  0       -- Keine Kündigungsfrist
);

-- =====================================================================================
-- MIGRATION ABGESCHLOSSEN
-- =====================================================================================
