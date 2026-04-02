-- ============================================================================
-- Migration 045: Rücklastschrift & Dispute Tabellen
-- Für automatische Verarbeitung von Chargebacks (Stripe) und Rücklastschriften (Bank)
-- ============================================================================

-- Stripe Disputes (Chargebacks)
CREATE TABLE IF NOT EXISTS stripe_disputes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stripe_dispute_id VARCHAR(100) UNIQUE NOT NULL,
    stripe_charge_id VARCHAR(100),
    mitglied_id INT,
    dojo_id INT,
    amount INT NOT NULL COMMENT 'Betrag in Cents',
    currency VARCHAR(10) DEFAULT 'eur',
    reason VARCHAR(50),
    status VARCHAR(50) DEFAULT 'needs_response',
    evidence_due_by DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_dispute_charge (stripe_charge_id),
    INDEX idx_dispute_member (mitglied_id),
    INDEX idx_dispute_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Offene Zahlungen (für alle Zahlungsprobleme)
CREATE TABLE IF NOT EXISTS offene_zahlungen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    dojo_id INT NOT NULL,
    betrag DECIMAL(10,2) NOT NULL,
    typ ENUM('ruecklastschrift', 'fehlgeschlagen', 'chargeback', 'mahnung', 'sonstig') DEFAULT 'ruecklastschrift',
    status ENUM('offen', 'in_bearbeitung', 'erledigt', 'storniert') DEFAULT 'offen',
    beschreibung TEXT,
    referenz VARCHAR(255) COMMENT 'Externe Referenz (Dispute-ID, Transaction-ID, etc.)',
    original_rechnung_id INT,
    mahnungen_gesendet INT DEFAULT 0,
    letzte_mahnung DATETIME,
    erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    bearbeitet_am DATETIME,
    bearbeitet_von INT,
    notizen TEXT,

    INDEX idx_offene_mitglied (mitglied_id),
    INDEX idx_offene_dojo (dojo_id),
    INDEX idx_offene_status (status),
    INDEX idx_offene_typ (typ),
    INDEX idx_offene_referenz (referenz),

    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zahlungsproblem-Felder in Mitglieder-Tabelle
ALTER TABLE mitglieder
    ADD COLUMN IF NOT EXISTS zahlungsproblem TINYINT(1) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS zahlungsproblem_details TEXT,
    ADD COLUMN IF NOT EXISTS zahlungsproblem_datum DATETIME;

-- Index für schnelle Filterung
ALTER TABLE mitglieder
    ADD INDEX IF NOT EXISTS idx_zahlungsproblem (zahlungsproblem);

-- ============================================================================
-- Hinweis: Nach dem Ausführen dieser Migration werden:
-- 1. Stripe Chargebacks automatisch als offene Zahlungen erfasst
-- 2. SEPA Rücklastschriften automatisch als offene Zahlungen erfasst
-- 3. Mitglieder mit Zahlungsproblemen markiert
-- ============================================================================
