-- ============================================================
-- 095: Partner-Dokumente um Editor-Felder erweitern
-- ============================================================

ALTER TABLE partner_documents
  ADD COLUMN content_html  MEDIUMTEXT  NULL   AFTER description_en,
  ADD COLUMN primary_color VARCHAR(7)  NULL   DEFAULT '#c9a227' AFTER content_html,
  ADD COLUMN source        ENUM('file','editor') NOT NULL DEFAULT 'file' AFTER primary_color;
