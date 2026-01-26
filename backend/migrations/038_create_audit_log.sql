-- ============================================================================
-- Migration: 038_create_audit_log.sql
-- Beschreibung: Erstellt Audit-Log Tabelle für Nachverfolgung aller Änderungen
-- Datum: 2026-01-26
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- Zeitstempel
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Wer hat die Aktion ausgeführt?
    user_id INT NULL,
    user_email VARCHAR(255) NULL,
    user_name VARCHAR(255) NULL,
    user_role VARCHAR(50) NULL,

    -- In welchem Dojo?
    dojo_id INT NULL,
    dojo_name VARCHAR(255) NULL,

    -- Was wurde gemacht?
    aktion VARCHAR(100) NOT NULL,
    kategorie ENUM('MITGLIED', 'FINANZEN', 'VERTRAG', 'PRUEFUNG', 'ADMIN', 'SEPA', 'DOKUMENT', 'SYSTEM', 'AUTH') NOT NULL,

    -- An welchem Datensatz?
    entity_type VARCHAR(100) NULL,
    entity_id INT NULL,
    entity_name VARCHAR(255) NULL,

    -- Details der Änderung
    alte_werte JSON NULL,
    neue_werte JSON NULL,
    beschreibung TEXT NULL,

    -- Technische Infos
    ip_adresse VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    request_method VARCHAR(10) NULL,
    request_path VARCHAR(500) NULL,

    -- Indizes für schnelle Suche
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_dojo (dojo_id),
    INDEX idx_audit_aktion (aktion),
    INDEX idx_audit_kategorie (kategorie),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_composite (dojo_id, kategorie, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- View für einfache Abfragen mit lesbaren Daten
CREATE OR REPLACE VIEW v_audit_log AS
SELECT
    al.id,
    al.created_at,
    al.user_name,
    al.user_email,
    al.user_role,
    al.dojo_name,
    al.aktion,
    al.kategorie,
    al.entity_type,
    al.entity_id,
    al.entity_name,
    al.beschreibung,
    al.alte_werte,
    al.neue_werte,
    al.ip_adresse
FROM audit_log al
ORDER BY al.created_at DESC;
