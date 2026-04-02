-- Chat-Tabellen für Dojosoftware
-- Migration: 2026-03-01
-- Ausführen: mysql -u user -p dojo_db < create_chat_tables.sql

CREATE TABLE IF NOT EXISTS chat_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  type ENUM('direct','group','announcement') NOT NULL DEFAULT 'group',
  name VARCHAR(255) NULL,
  description TEXT NULL,
  created_by_id INT NOT NULL,
  created_by_type ENUM('mitglied','trainer','admin') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo_id (dojo_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_room_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  member_id INT NOT NULL,
  member_type ENUM('mitglied','trainer','admin') NOT NULL,
  role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  muted BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member (room_id, member_id, member_type),
  INDEX idx_member (member_id, member_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_type ENUM('mitglied','trainer','admin') NOT NULL,
  message_type ENUM('text','push_ref') NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  push_notification_id INT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  INDEX idx_room_sent (room_id, sent_at),
  INDEX idx_sender (sender_id, sender_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_message_reads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  room_id INT NOT NULL,
  member_id INT NOT NULL,
  member_type ENUM('mitglied','trainer','admin') NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_read (message_id, member_id, member_type),
  INDEX idx_member_room (member_id, member_type, room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  member_id INT NOT NULL,
  member_type ENUM('mitglied','trainer','admin') NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reaction (message_id, member_id, member_type, emoji),
  INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
