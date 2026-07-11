-- Phase 3: P2-Vorlagen/Config pro Dojo trennen — Muster "globale Defaults + Pro-Dojo-Override".
-- dojo_id ist NULLABLE: bestehende Zeilen bleiben dojo_id=NULL = globale Defaults (für alle nutzbar).
-- Ein Dojo, das eine Vorlage anpasst, bekommt eine eigene Zeile (dojo_id gesetzt), die die globale
-- via Query-Logik ( ... AND (dojo_id=? OR dojo_id IS NULL) ORDER BY dojo_id DESC LIMIT 1 ) überschreibt.
-- UNIQUE(name/schluessel) → UNIQUE(dojo_id, name/schluessel), damit dojo-eigene Varianten möglich sind.
-- NICHTS wird gelöscht, nichts bricht (neue/andere Dojos nutzen weiter die globalen Defaults).

-- email_templates (UNIQUE name → (dojo_id,name))
ALTER TABLE email_templates ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER id;
ALTER TABLE email_templates DROP INDEX name;
ALTER TABLE email_templates ADD UNIQUE KEY uk_dojo_name (dojo_id, name);
ALTER TABLE email_templates ADD INDEX idx_dojo (dojo_id);

-- dokument_templates (kein UNIQUE name → nur Spalte + Index)
ALTER TABLE dokument_templates ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER id;
ALTER TABLE dokument_templates ADD INDEX idx_dojo (dojo_id);

-- fortschritt_kategorien (UNIQUE name → (dojo_id,name))
ALTER TABLE fortschritt_kategorien ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER kategorie_id;
ALTER TABLE fortschritt_kategorien DROP INDEX name;
ALTER TABLE fortschritt_kategorien ADD UNIQUE KEY uk_dojo_name (dojo_id, name);
ALTER TABLE fortschritt_kategorien ADD INDEX idx_dojo (dojo_id);

-- verkauf_einstellungen (UNIQUE schluessel → (dojo_id,schluessel))
ALTER TABLE verkauf_einstellungen ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER einstellung_id;
ALTER TABLE verkauf_einstellungen DROP INDEX schluessel;
ALTER TABLE verkauf_einstellungen ADD UNIQUE KEY uk_dojo_schluessel (dojo_id, schluessel);
ALTER TABLE verkauf_einstellungen ADD INDEX idx_dojo (dojo_id);
