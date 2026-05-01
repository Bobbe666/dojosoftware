-- ============================================================
-- 097: Community — Schwarzes Brett, Marktplatz, Training, Events
-- ============================================================

CREATE TABLE IF NOT EXISTS community_posts (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT           NOT NULL,
  mitglied_id       INT           NOT NULL,
  category          ENUM('bulletin','marketplace','training','event') NOT NULL,
  title             VARCHAR(200)  NOT NULL,
  description       TEXT          NOT NULL,
  images            JSON          NULL,
  -- Marktplatz
  price             DECIMAL(10,2) NULL,
  price_type        ENUM('fixed','negotiable','free','exchange') NULL,
  item_condition    VARCHAR(100)  NULL,
  -- Trainingspartner
  training_style    VARCHAR(100)  NULL,
  training_days     VARCHAR(200)  NULL,
  training_time     VARCHAR(100)  NULL,
  training_level    VARCHAR(100)  NULL,
  -- Event
  event_date        DATETIME      NULL,
  event_location    VARCHAR(200)  NULL,
  -- Kontakt
  show_contact_info TINYINT(1)    NOT NULL DEFAULT 0,
  contact_phone     VARCHAR(50)   NULL,
  contact_email     VARCHAR(200)  NULL,
  -- Status
  status            ENUM('pending','active','closed','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason  TEXT          NULL,
  views             INT           NOT NULL DEFAULT 0,
  expires_at        DATETIME      NULL,
  created_at        DATETIME      NOT NULL DEFAULT NOW(),
  updated_at        DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_dojo_status (dojo_id, status),
  INDEX idx_category (category),
  INDEX idx_mitglied (mitglied_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
