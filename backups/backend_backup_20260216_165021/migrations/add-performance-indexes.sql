-- ============================================================================
-- Performance Indexes Migration
-- Erstellt: 2026-01-31
-- Beschreibung: Fügt Indexes für häufig abgefragte Spalten hinzu
-- Kompatibel mit MySQL 5.7+
-- ============================================================================

DELIMITER //

-- Hilfsprozedur zum sicheren Erstellen von Indexes
DROP PROCEDURE IF EXISTS create_index_if_not_exists//
CREATE PROCEDURE create_index_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_columns VARCHAR(255)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index;

    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', p_index, ' ON ', p_table, '(', p_columns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Index erstellt: ', p_index, ' auf ', p_table) AS status;
    ELSE
        SELECT CONCAT('Index existiert bereits: ', p_index, ' auf ', p_table) AS status;
    END IF;
END//

DELIMITER ;

-- ============================================================================
-- Mitglieder Tabelle (häufigste Abfragen)
-- ============================================================================

CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_dojo_id', 'dojo_id');
CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_aktiv', 'aktiv');
CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_dojo_aktiv', 'dojo_id, aktiv');
CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_email', 'email');
CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_nachname', 'nachname');
CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_vorname', 'vorname');
CALL create_index_if_not_exists('mitglieder', 'idx_mitglieder_name_sort', 'nachname, vorname');

-- ============================================================================
-- Anwesenheit Tabelle (häufige JOINs)
-- ============================================================================

CALL create_index_if_not_exists('anwesenheit', 'idx_anwesenheit_mitglied_id', 'mitglied_id');
CALL create_index_if_not_exists('anwesenheit', 'idx_anwesenheit_datum', 'datum');
CALL create_index_if_not_exists('anwesenheit', 'idx_anwesenheit_mitglied_datum', 'mitglied_id, datum');
CALL create_index_if_not_exists('anwesenheit', 'idx_anwesenheit_anwesend', 'anwesend');

-- ============================================================================
-- Verträge Tabelle
-- ============================================================================

CALL create_index_if_not_exists('vertraege', 'idx_vertraege_mitglied_id', 'mitglied_id');
CALL create_index_if_not_exists('vertraege', 'idx_vertraege_status', 'status');
CALL create_index_if_not_exists('vertraege', 'idx_vertraege_mitglied_status', 'mitglied_id, status');

-- ============================================================================
-- Prüfungen Tabelle
-- ============================================================================

CALL create_index_if_not_exists('pruefungen', 'idx_pruefungen_mitglied_id', 'mitglied_id');
CALL create_index_if_not_exists('pruefungen', 'idx_pruefungen_stil_id', 'stil_id');
CALL create_index_if_not_exists('pruefungen', 'idx_pruefungen_dojo_id', 'dojo_id');
CALL create_index_if_not_exists('pruefungen', 'idx_pruefungen_datum', 'pruefungsdatum');
CALL create_index_if_not_exists('pruefungen', 'idx_pruefungen_status', 'status');

-- ============================================================================
-- Mitglied-Stil-Data Tabelle
-- ============================================================================

CALL create_index_if_not_exists('mitglied_stil_data', 'idx_mitglied_stil_data_mitglied', 'mitglied_id');
CALL create_index_if_not_exists('mitglied_stil_data', 'idx_mitglied_stil_data_stil', 'stil_id');
CALL create_index_if_not_exists('mitglied_stil_data', 'idx_mitglied_stil_data_graduierung', 'current_graduierung_id');

-- ============================================================================
-- SEPA Mandate Tabelle
-- ============================================================================

CALL create_index_if_not_exists('sepa_mandate', 'idx_sepa_mandate_mitglied_id', 'mitglied_id');
CALL create_index_if_not_exists('sepa_mandate', 'idx_sepa_mandate_status', 'status');

-- ============================================================================
-- Users/Auth Tabellen
-- ============================================================================

CALL create_index_if_not_exists('users', 'idx_users_email', 'email');
CALL create_index_if_not_exists('users', 'idx_users_username', 'username');
CALL create_index_if_not_exists('admin_users', 'idx_admin_users_email', 'email');
CALL create_index_if_not_exists('admin_users', 'idx_admin_users_username', 'username');
CALL create_index_if_not_exists('admin_users', 'idx_admin_users_dojo_id', 'dojo_id');

-- ============================================================================
-- Notifications Tabelle
-- ============================================================================

CALL create_index_if_not_exists('notifications', 'idx_notifications_recipient', 'recipient_id, recipient_type');
CALL create_index_if_not_exists('notifications', 'idx_notifications_read', 'is_read');
CALL create_index_if_not_exists('notifications', 'idx_notifications_created', 'created_at');

-- ============================================================================
-- Stundenplan/Kurse Tabellen
-- ============================================================================

CALL create_index_if_not_exists('stundenplan', 'idx_stundenplan_dojo_id', 'dojo_id');
CALL create_index_if_not_exists('stundenplan', 'idx_stundenplan_stil_id', 'stil_id');
CALL create_index_if_not_exists('kurse', 'idx_kurse_dojo_id', 'dojo_id');

-- ============================================================================
-- Aufräumen
-- ============================================================================

DROP PROCEDURE IF EXISTS create_index_if_not_exists;

-- ============================================================================
-- ANALYZE TABLES für Statistik-Update
-- ============================================================================

ANALYZE TABLE mitglieder;
ANALYZE TABLE anwesenheit;
ANALYZE TABLE vertraege;
ANALYZE TABLE pruefungen;
ANALYZE TABLE mitglied_stil_data;
ANALYZE TABLE sepa_mandate;
ANALYZE TABLE users;
ANALYZE TABLE admin_users;
ANALYZE TABLE notifications;
ANALYZE TABLE stundenplan;
ANALYZE TABLE kurse;

SELECT 'Migration abgeschlossen - Performance Indexes hinzugefügt' AS result;
