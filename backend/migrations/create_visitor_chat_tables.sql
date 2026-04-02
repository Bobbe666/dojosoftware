-- =============================================
-- VISITOR CHAT TABLES
-- Besucher-Chat Widget für TDA-Websites
-- =============================================

CREATE TABLE IF NOT EXISTS visitor_chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NULL,                           -- NULL = Super-Admin-Chat (tda-intl.org etc.)
  source_site VARCHAR(255) DEFAULT NULL,      -- 'tda-vib.de', 'tda-intl.org' etc.
  visitor_name VARCHAR(100) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_token VARCHAR(64) NOT NULL UNIQUE,  -- Zufalls-Token für Besucher-Auth (kein JWT)
  status ENUM('open','active','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo_id (dojo_id),
  INDEX idx_status (status),
  INDEX idx_visitor_token (visitor_token)
);

CREATE TABLE IF NOT EXISTS visitor_chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  sender_type ENUM('visitor','staff') NOT NULL,
  sender_id INT NULL,           -- Staff-User-ID wenn sender_type='staff'
  sender_name VARCHAR(100) NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES visitor_chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at)
);
