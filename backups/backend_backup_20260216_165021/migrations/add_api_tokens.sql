-- ===================================================================
-- Migration: Add API Token fields to dojo table
-- Description: Adds secure API token authentication for each dojo
-- Created: 2025-12-28
-- ===================================================================

-- Add API token fields to dojo table
ALTER TABLE dojo
ADD COLUMN IF NOT EXISTS api_token VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS api_token_created_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS api_token_last_used TIMESTAMP DEFAULT NULL;

-- Add unique index on api_token (only for non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dojo_api_token
ON dojo(api_token)
WHERE api_token IS NOT NULL;

-- Add index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_dojo_api_token_lookup
ON dojo(api_token, ist_aktiv);

-- Add comment to table
COMMENT ON COLUMN dojo.api_token IS 'Unique API token for TDA integration (UUID format)';
COMMENT ON COLUMN dojo.api_token_created_at IS 'When the API token was created/regenerated';
COMMENT ON COLUMN dojo.api_token_last_used IS 'Last time the API token was used for authentication';
