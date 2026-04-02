-- =============================================
-- MIGRATION 029: Trial & Subscription Management
-- =============================================
-- Fügt Felder für Trial-Verwaltung und Subscription-Status hinzu

USE dojo;

-- 1. Trial & Subscription Felder
ALTER TABLE dojo
  ADD COLUMN IF NOT EXISTS trial_ends_at DATETIME DEFAULT NULL COMMENT '14 Tage nach created_at',
  ADD COLUMN IF NOT EXISTS subscription_status ENUM('trial', 'active', 'expired', 'cancelled', 'suspended') DEFAULT 'trial' COMMENT 'Status des Abonnements',
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basic' COMMENT 'Tarif: basic, premium, enterprise',
  ADD COLUMN IF NOT EXISTS subscription_started_at DATETIME DEFAULT NULL COMMENT 'Wann wurde bezahlt',
  ADD COLUMN IF NOT EXISTS subscription_ends_at DATETIME DEFAULT NULL COMMENT 'Abo-Ende (NULL = unbegrenzt)',
  ADD COLUMN IF NOT EXISTS last_payment_at DATETIME DEFAULT NULL COMMENT 'Letzte Zahlung',
  ADD COLUMN IF NOT EXISTS payment_interval ENUM('monthly', 'quarterly', 'yearly') DEFAULT 'monthly' COMMENT 'Zahlungsintervall';

-- 2. Setze trial_ends_at für bestehende Dojos (14 Tage nach created_at)
UPDATE dojo
SET trial_ends_at = DATE_ADD(created_at, INTERVAL 14 DAY)
WHERE trial_ends_at IS NULL;

-- 3. Setze Status für bestehende Dojos
UPDATE dojo
SET subscription_status = CASE
  WHEN trial_ends_at > NOW() THEN 'trial'
  WHEN trial_ends_at <= NOW() THEN 'expired'
  ELSE 'trial'
END
WHERE subscription_status = 'trial';

-- 4. Index für Performance
CREATE INDEX IF NOT EXISTS idx_dojo_trial_status ON dojo(subscription_status, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_dojo_subscription_ends ON dojo(subscription_ends_at);

-- 5. Zeige Ergebnis
SELECT
  id,
  dojoname,
  created_at,
  trial_ends_at,
  subscription_status,
  DATEDIFF(trial_ends_at, NOW()) as days_remaining
FROM dojo
ORDER BY trial_ends_at;
