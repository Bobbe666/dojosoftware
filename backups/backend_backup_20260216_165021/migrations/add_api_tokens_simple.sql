-- Add API Token fields to dojo table
-- MySQL/MariaDB compatible

ALTER TABLE dojo
ADD COLUMN api_token VARCHAR(255) DEFAULT NULL,
ADD COLUMN api_token_created_at DATETIME DEFAULT NULL,
ADD COLUMN api_token_last_used DATETIME DEFAULT NULL;

-- Add unique index on api_token
CREATE UNIQUE INDEX idx_dojo_api_token ON dojo(api_token);

-- Add index for quick token lookup
CREATE INDEX idx_dojo_api_token_lookup ON dojo(api_token, ist_aktiv);
