-- =====================================================
-- Migration 070: Shop Multi-Tenant + Erweiterungen
-- Datum: 2026-03-12
-- Beschreibung:
--   - dojo_id zu shop-Tabellen hinzufügen (NULL = TDA-Zentralshop)
--   - typ-Feld für spezielle Produkttypen (Pass, Urkunde etc.)
--   - Guest-Checkout: verbandsmitgliedschaft_id nullable machen
--   - Tracking-Nummer und weitere Felder für Bestellungen
--   - shop_bestellpositionen: Personalisierung für Pässe/Urkunden
--   - Neue Tabelle: shop_einstellungen (Stripe-Keys, Versandkosten etc.)
-- =====================================================

-- 1. shop_kategorien: dojo_id hinzufügen
ALTER TABLE shop_kategorien
  ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER id;

-- Bestehende Kategorien gehören TDA (dojo_id bleibt NULL)

-- 2. shop_produkte: dojo_id und typ hinzufügen
ALTER TABLE shop_produkte
  ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER id,
  ADD COLUMN typ ENUM('standard','pass','urkunde','equipment','bekleidung') NOT NULL DEFAULT 'standard' AFTER aktiv;

-- Bestehende Produkte gehören TDA (dojo_id bleibt NULL)

-- 3. shop_bestellungen: Guest-Checkout + dojo_id + Tracking
ALTER TABLE shop_bestellungen
  ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER id,
  ADD COLUMN gast_bestellung TINYINT(1) NOT NULL DEFAULT 0 AFTER bestellnummer,
  ADD COLUMN tracking_nummer VARCHAR(100) NULL DEFAULT NULL AFTER interne_notiz,
  ADD COLUMN versand_dienstleister VARCHAR(50) NULL DEFAULT NULL AFTER tracking_nummer;

-- verbandsmitgliedschaft_id: NOT NULL → NULL erlauben (für Guest-Checkout)
ALTER TABLE shop_bestellungen
  MODIFY COLUMN verbandsmitgliedschaft_id INT NULL DEFAULT NULL;

-- Index für dojo_id
ALTER TABLE shop_bestellungen
  ADD INDEX idx_dojo (dojo_id);

-- Bestehende Bestellungen gehören TDA
UPDATE shop_bestellungen SET gast_bestellung = 0 WHERE gast_bestellung IS NULL;

-- 4. shop_bestellpositionen: Personalisierung für Pässe/Urkunden
ALTER TABLE shop_bestellpositionen
  ADD COLUMN mitglied_id INT NULL DEFAULT NULL AFTER produkt_id,
  ADD COLUMN personalisierung JSON NULL DEFAULT NULL AFTER mitglied_id,
  ADD COLUMN optionen JSON NULL DEFAULT NULL AFTER personalisierung;
-- personalisierung: z.B. {"vorname": "Max", "nachname": "Mustermann", "graduierung": "3. Dan"}
-- optionen: z.B. {"groesse": "M", "farbe": "Schwarz"}

-- 5. Neue Tabelle: shop_einstellungen
CREATE TABLE IF NOT EXISTS shop_einstellungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NULL DEFAULT NULL COMMENT 'NULL = TDA-Zentralshop',
  shop_aktiv TINYINT(1) NOT NULL DEFAULT 0,
  shop_name VARCHAR(200) NULL DEFAULT NULL,
  shop_beschreibung TEXT NULL DEFAULT NULL,
  shop_logo_url VARCHAR(500) NULL DEFAULT NULL,
  stripe_publishable_key VARCHAR(200) NULL DEFAULT NULL,
  stripe_secret_key VARCHAR(200) NULL DEFAULT NULL,
  stripe_webhook_secret VARCHAR(200) NULL DEFAULT NULL,
  versandkostenfrei_ab_cent INT NOT NULL DEFAULT 5000 COMMENT 'Kostenloser Versand ab diesem Betrag (Cent)',
  standard_versandkosten_cent INT NOT NULL DEFAULT 495 COMMENT 'Standard-Versandkosten in Cent',
  rechnung_erlaubt TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Bestellung auf Rechnung erlaubt',
  impressum_zusatz TEXT NULL DEFAULT NULL,
  erstellt_am TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dojo_shop (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TDA-Zentralshop Eintrag (dojo_id = NULL)
INSERT INTO shop_einstellungen (dojo_id, shop_aktiv, shop_name, shop_beschreibung)
VALUES (NULL, 1, 'TDA Shop', 'Offizieller Shop des Taijutsu Deutschland Verbandes')
ON DUPLICATE KEY UPDATE shop_name = 'TDA Shop';
