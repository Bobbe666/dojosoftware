-- ============================================================
-- Migration 127: Notification Audit Trail
-- Vollständige Nachverfolgung aller versendeten Benachrichtigungen
-- ============================================================

-- 1. notifications-Tabelle: Audit-Felder hinzufügen
ALTER TABLE notifications
  ADD COLUMN dojo_id INT NULL COMMENT 'Welches Dojo hat die Benachrichtigung ausgeloest',
  ADD COLUMN sent_by_admin_id INT NULL COMMENT 'Admin der die Benachrichtigung gesendet hat',
  ADD COLUMN notification_group_id VARCHAR(64) NULL COMMENT 'Gruppierungs-ID fuer Massen-Sends (z.B. email_TIMESTAMP_adminId)';

ALTER TABLE notifications
  ADD INDEX idx_notif_dojo_id (dojo_id),
  ADD INDEX idx_notif_sent_by (sent_by_admin_id),
  ADD INDEX idx_notif_group_id (notification_group_id);

-- 2. pruefungen-Tabelle: Erinnerungs-Tracking
ALTER TABLE pruefungen
  ADD COLUMN erinnerung_gesendet_am DATETIME NULL COMMENT 'Wann wurde die letzte Erinnerung an diesen Kandidaten gesendet',
  ADD COLUMN erinnerung_anzahl INT NOT NULL DEFAULT 0 COMMENT 'Wie oft wurde eine Erinnerung gesendet';

-- ============================================================
-- Migration abgeschlossen
-- ============================================================
