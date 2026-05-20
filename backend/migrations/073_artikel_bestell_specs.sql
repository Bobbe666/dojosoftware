-- ============================================================
-- Migration 073: Artikel-Bestell-Spezifikationen (Enterprise)
-- ============================================================
-- Pro-Artikel gespeicherte Bestell-Specs: Lieferant, Material,
-- Stickerei, Label, Verpackung, Maßtabelle, Modell-Fotos.
-- Verfügbar nur im Enterprise-Plan (feature_bestellsystem).
-- ============================================================

-- 1. Bestell-Specs Tabelle
CREATE TABLE IF NOT EXISTS artikel_bestell_specs (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  artikel_id           INT NOT NULL,
  dojo_id              INT NOT NULL,
  lieferant_id         INT NULL,
  modell_bezeichnung   VARCHAR(255) DEFAULT NULL,
  artikel_nr_lieferant VARCHAR(100) DEFAULT NULL,
  farbe                VARCHAR(100) DEFAULT 'Weiß',
  wkf                  TINYINT(1) DEFAULT 0,
  material_specs       JSON NULL COMMENT 'material[], webart[], grammatur[], materialText',
  stickerei_specs      JSON NULL COMMENT 'positionen[], text, garnfarben, bemerkung',
  label_specs          JSON NULL COMMENT 'labelText, labelArt[], labelPosition[], labelSprachen[], labelZusatz',
  verpackung_specs     JSON NULL COMMENT 'typ, stueck_beutel, stueck_karton, bemerkung',
  mass_tabelle         JSON NULL COMMENT 'Maßtabelle {groesse: {rL,rB,...}}',
  bemerkungen          TEXT DEFAULT NULL,
  foto_urls            JSON NULL COMMENT 'Array {url, label} für Modell-/Detailfotos',
  erstellt_am          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_artikel (artikel_id),
  INDEX idx_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Feature-Flag in dojo_subscriptions
ALTER TABLE dojo_subscriptions
  ADD COLUMN IF NOT EXISTS feature_bestellsystem BOOLEAN DEFAULT FALSE
  COMMENT 'Enterprise: Artikel-Bestellsystem mit Bestell-PDF';

-- 3. Feature-Flag in subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS feature_bestellsystem BOOLEAN DEFAULT FALSE;

-- 4. Nur Enterprise erhält das Feature
UPDATE subscription_plans
  SET feature_bestellsystem = TRUE
  WHERE plan_name = 'enterprise';

-- 5. Bestehende Enterprise-Subscriptions nachziehen
UPDATE dojo_subscriptions s
  JOIN subscription_plans p ON p.plan_name = s.plan_type
  SET s.feature_bestellsystem = p.feature_bestellsystem;
