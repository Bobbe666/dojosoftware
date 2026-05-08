-- Markiert Dojos die direkt von der Plattform (TDA) verwaltet werden
-- Diese erscheinen im Super-Admin Dashboard, Lizenznehmer-Dojos nicht
ALTER TABLE dojo ADD COLUMN IF NOT EXISTS platform_managed TINYINT(1) NOT NULL DEFAULT 0;

-- TDA International + Kampfkunstschule Schreiner sind Platform-Dojos
UPDATE dojo SET platform_managed = 1 WHERE id IN (2, 3);
