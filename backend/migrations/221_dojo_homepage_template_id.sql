-- Migration 221: fehlende Spalte template_id in dojo_homepage
-- Der Homepage-Builder (PUT /config, render) erwartet sie; ohne sie schlug jedes Speichern fehl.
ALTER TABLE dojo_homepage
  ADD COLUMN IF NOT EXISTS template_id VARCHAR(32) NOT NULL DEFAULT 'traditional';
