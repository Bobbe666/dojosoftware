-- ============================================================================
-- Migration 185: Manuelle Erstattungen (außerhalb Stripe)
-- ----------------------------------------------------------------------------
-- Für Fälle, in denen ein Betrag NICHT über Stripe, sondern manuell von einem
-- anderen Konto zurückerstattet wurde (z. B. Birkner, Ramsauer). Diese
-- Erstattungen erscheinen in der Mitglieder-Finanzübersicht in Spalte ⑤
-- ("Rückerstattung") neben den Stripe-Refunds.
-- ============================================================================

CREATE TABLE IF NOT EXISTS manuelle_erstattungen (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  transaktion_id  INT NULL,                 -- Bezug zur stripe_lastschrift_transaktion (optional)
  mitglied_id     INT NOT NULL,
  dojo_id         INT NOT NULL,
  betrag          DECIMAL(10,2) NOT NULL,
  erstattet_am    DATE NOT NULL,
  quelle          VARCHAR(255) NULL,        -- von welchem Konto / wie erstattet
  bemerkung       TEXT NULL,                -- freie Bemerkungen
  erstellt_von    VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_me_tx (transaktion_id),
  INDEX idx_me_mitglied (mitglied_id),
  INDEX idx_me_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
