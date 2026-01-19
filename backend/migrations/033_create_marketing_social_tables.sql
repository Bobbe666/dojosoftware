-- =============================================================================
-- MARKETING SOCIAL MEDIA TABLES
-- =============================================================================
-- Tabellen für Social Media Integration (Facebook/Instagram)
-- =============================================================================

-- Social Media Accounts verknüpft mit Dojo
CREATE TABLE IF NOT EXISTS marketing_social_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  platform ENUM('facebook', 'instagram') NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  access_token TEXT NOT NULL,
  token_expires_at DATETIME,
  page_id VARCHAR(255),
  page_name VARCHAR(255),
  instagram_business_account_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dojo_platform_account (dojo_id, platform, account_id),
  INDEX idx_dojo (dojo_id),
  INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Marketing Kampagnen
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled') DEFAULT 'draft',
  start_date DATETIME,
  end_date DATETIME,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Social Media Posts
CREATE TABLE IF NOT EXISTS marketing_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NOT NULL,
  campaign_id INT,
  social_account_id INT NOT NULL,
  content TEXT NOT NULL,
  media_urls JSON,
  post_type ENUM('text', 'image', 'video', 'link') DEFAULT 'text',
  status ENUM('draft', 'scheduled', 'published', 'failed') DEFAULT 'draft',
  scheduled_at DATETIME,
  published_at DATETIME,
  external_post_id VARCHAR(255),
  error_message TEXT,
  engagement_stats JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_campaign (campaign_id),
  INDEX idx_social_account (social_account_id),
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at),
  FOREIGN KEY (social_account_id) REFERENCES marketing_social_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Post-Media Verknüpfung (für mehrere Bilder pro Post)
CREATE TABLE IF NOT EXISTS marketing_post_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  media_type ENUM('image', 'video') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  mime_type VARCHAR(100),
  external_media_id VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post (post_id),
  FOREIGN KEY (post_id) REFERENCES marketing_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- OAuth State für CSRF Protection
CREATE TABLE IF NOT EXISTS marketing_oauth_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  state VARCHAR(64) NOT NULL UNIQUE,
  dojo_id INT NOT NULL,
  user_id INT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  INDEX idx_state (state),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
