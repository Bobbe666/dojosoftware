-- ============================================================
-- 096: Marketing Hub — TDA-eigene Social Accounts + Hub Posts
-- ============================================================

-- TDA-eigene Social-Media-Konten (plattformweit, kein dojo_id)
CREATE TABLE IF NOT EXISTS hub_social_accounts (
  id                              INT AUTO_INCREMENT PRIMARY KEY,
  label                           VARCHAR(100)  NOT NULL,               -- z.B. "TDA International", "TDA Verband"
  platform                        ENUM('facebook','instagram') NOT NULL,
  page_id                         VARCHAR(100)  NOT NULL,
  page_name                       VARCHAR(200)  NULL,
  instagram_business_account_id   VARCHAR(100)  NULL,
  access_token                    TEXT          NOT NULL,
  token_expires_at                DATETIME      NULL,
  is_active                       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at                      DATETIME      NOT NULL DEFAULT NOW(),
  updated_at                      DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hub-Posts: plattformweite Kampagnen die auf mehrere Kanäle gehen
CREATE TABLE IF NOT EXISTS hub_posts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  content       TEXT          NOT NULL,
  media_urls    JSON          NULL,
  status        ENUM('draft','scheduled','published','failed') NOT NULL DEFAULT 'draft',
  scheduled_at  DATETIME      NULL,
  published_at  DATETIME      NULL,
  created_by    VARCHAR(100)  NULL,
  created_at    DATETIME      NOT NULL DEFAULT NOW(),
  updated_at    DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verknüpfung: welcher Hub-Post auf welchem Kanal (TDA-Konto ODER Dojo-Konto)
CREATE TABLE IF NOT EXISTS hub_post_channels (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  hub_post_id         INT           NOT NULL,
  account_type        ENUM('hub','dojo') NOT NULL,   -- hub = tda-eigenes Konto, dojo = dojo-Konto
  hub_account_id      INT           NULL,             -- FK → hub_social_accounts.id
  dojo_account_id     INT           NULL,             -- FK → marketing_social_accounts.id
  platform            ENUM('facebook','instagram') NOT NULL,
  status              ENUM('pending','published','failed') NOT NULL DEFAULT 'pending',
  platform_post_id    VARCHAR(200)  NULL,
  error_message       TEXT          NULL,
  published_at        DATETIME      NULL,
  FOREIGN KEY (hub_post_id) REFERENCES hub_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
