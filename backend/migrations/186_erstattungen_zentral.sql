-- ============================================================================
-- Migration 186: Zentrale Erstattungs-Tabelle (für Buchhaltung/EÜR/USt)
-- ----------------------------------------------------------------------------
-- Vereint ALLE Rückerstattungen in einer Quelle, damit sie in EÜR, BWA,
-- UStVA und Auswertungen als Einnahmeminderung berücksichtigt werden können:
--   - manuell        : außerhalb Stripe (von anderem Konto)
--   - stripe_button  : über den "↩ Rückerstatten"-Button ausgelöst
--   - stripe_sync    : per Backfill/periodischem Sync aus Stripe gezogen
--   - stripe_extern  : per Webhook (charge.refunded) erfasst
--
-- betrag = positiver Brutto-Erstattungsbetrag (wird in der Buchhaltung
-- als NEGATIVE Einnahme im erstattet_am-Datum verrechnet, §11 EStG).
-- mwst_satz/quelle_art steuern die USt-Korrektur (§17 UStG).
-- ============================================================================

CREATE TABLE IF NOT EXISTS erstattungen (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id                   INT NOT NULL,
  mitglied_id               INT NULL,
  quelle                    ENUM('manuell','stripe_button','stripe_sync','stripe_extern') NOT NULL DEFAULT 'manuell',
  transaktion_id            INT NULL,             -- stripe_lastschrift_transaktion.id
  stripe_payment_intent_id  VARCHAR(255) NULL,
  stripe_charge_id          VARCHAR(255) NULL,
  stripe_refund_id          VARCHAR(255) NULL,    -- Dedup-Schlüssel (re_... / pyr_...)
  betrag                    DECIMAL(10,2) NOT NULL,
  mwst_satz                 DECIMAL(5,2) NULL,    -- USt-Satz des ursprünglichen Postens
  quelle_art                VARCHAR(20) NULL,     -- beitrag|verkauf|rechnung|unbekannt
  erstattet_am              DATE NOT NULL,
  quelle_konto              VARCHAR(255) NULL,    -- bei manuell: von welchem Konto
  bemerkung                 TEXT NULL,
  status                    VARCHAR(20) NOT NULL DEFAULT 'erstattet',  -- erstattet|storniert
  erstellt_von              VARCHAR(255) NULL,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_refund (stripe_refund_id),
  INDEX idx_dojo_datum (dojo_id, erstattet_am),
  INDEX idx_mitglied (mitglied_id),
  INDEX idx_tx (transaktion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bestehende manuelle Erstattungen übernehmen (Migration 185 → 186)
INSERT INTO erstattungen
  (dojo_id, mitglied_id, quelle, transaktion_id, betrag, erstattet_am, quelle_konto, bemerkung, erstellt_von, created_at)
SELECT dojo_id, mitglied_id, 'manuell', transaktion_id, betrag, erstattet_am, quelle, bemerkung, erstellt_von, created_at
FROM manuelle_erstattungen
WHERE NOT EXISTS (
  SELECT 1 FROM erstattungen e
  WHERE e.quelle = 'manuell' AND e.mitglied_id = manuelle_erstattungen.mitglied_id
    AND e.betrag = manuelle_erstattungen.betrag AND e.erstattet_am = manuelle_erstattungen.erstattet_am
);
