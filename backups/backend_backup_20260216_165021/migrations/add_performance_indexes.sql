-- =====================================================================================
-- PERFORMANCE INDEXES FÜR DOJOSOFTWARE
-- =====================================================================================
-- Erstellt am: 2026-01-09
-- Zweck: Verbessert Query-Performance durch strategische Indizes
-- WICHTIG: Vor Ausführung Backup erstellen!
-- =====================================================================================

-- Prüfe ob Index bereits existiert (MySQL 8.0+)
-- Falls MySQL < 8.0, manuell ausführen und Fehler ignorieren

-- =====================================================================================
-- MITGLIEDER TABELLE
-- =====================================================================================

-- Hauptfilter: dojo_id (für Multi-Tenancy Isolation)
CREATE INDEX IF NOT EXISTS idx_mitglieder_dojo_id 
ON mitglieder(dojo_id);

-- Email für Login/Suche
CREATE INDEX IF NOT EXISTS idx_mitglieder_email 
ON mitglieder(email);

-- Status für aktive/inaktive Filter
CREATE INDEX IF NOT EXISTS idx_mitglieder_status 
ON mitglieder(status);

-- Composite Index für häufigste Query: dojo + status
CREATE INDEX IF NOT EXISTS idx_mitglieder_dojo_status 
ON mitglieder(dojo_id, status);

-- Mitgliedsnummer für Suche
CREATE INDEX IF NOT EXISTS idx_mitglieder_mitgliedsnummer 
ON mitglieder(mitgliedsnummer);

-- =====================================================================================
-- VERTRÄGE TABELLE
-- =====================================================================================

-- Multi-Tenancy Filter
CREATE INDEX IF NOT EXISTS idx_vertraege_dojo_id 
ON vertraege(dojo_id);

-- Relation zu Mitglied
CREATE INDEX IF NOT EXISTS idx_vertraege_mitglied_id 
ON vertraege(mitglied_id);

-- Status-Filter (aktiv, gekündigt, etc.)
CREATE INDEX IF NOT EXISTS idx_vertraege_status 
ON vertraege(status);

-- Composite: dojo + mitglied (häufigste Abfrage)
CREATE INDEX IF NOT EXISTS idx_vertraege_dojo_mitglied 
ON vertraege(dojo_id, mitglied_id);

-- Datumsbasierte Queries
CREATE INDEX IF NOT EXISTS idx_vertraege_vertragsbeginn 
ON vertraege(vertragsbeginn);

CREATE INDEX IF NOT EXISTS idx_vertraege_kuendigungsdatum 
ON vertraege(kuendigungsdatum);

-- =====================================================================================
-- TRANSAKTIONEN TABELLE
-- =====================================================================================

-- Multi-Tenancy
CREATE INDEX IF NOT EXISTS idx_transaktionen_dojo_id 
ON transaktionen(dojo_id);

-- Relation zu Mitglied
CREATE INDEX IF NOT EXISTS idx_transaktionen_mitglied_id 
ON transaktionen(mitglied_id);

-- Datum für Berichte
CREATE INDEX IF NOT EXISTS idx_transaktionen_datum 
ON transaktionen(datum);

-- Status (erfolgreich, fehlgeschlagen)
CREATE INDEX IF NOT EXISTS idx_transaktionen_status 
ON transaktionen(status);

-- Composite für Dashboard-Queries
CREATE INDEX IF NOT EXISTS idx_transaktionen_dojo_datum 
ON transaktionen(dojo_id, datum);

-- =====================================================================================
-- PRÜFUNGEN TABELLE
-- =====================================================================================

-- Multi-Tenancy
CREATE INDEX IF NOT EXISTS idx_pruefungen_dojo_id 
ON pruefungen(dojo_id);

-- Mitglied-Relation
CREATE INDEX IF NOT EXISTS idx_pruefungen_mitglied_id 
ON pruefungen(mitglied_id);

-- Datum für chronologische Sortierung
CREATE INDEX IF NOT EXISTS idx_pruefungen_datum 
ON pruefungen(datum);

-- Stil-Filter
CREATE INDEX IF NOT EXISTS idx_pruefungen_stil_id 
ON pruefungen(stil_id);

-- Gürtel-Filter
CREATE INDEX IF NOT EXISTS idx_pruefungen_guertel_id 
ON pruefungen(guertel_id);

-- =====================================================================================
-- ANWESENHEIT TABELLE
-- =====================================================================================

-- Multi-Tenancy
CREATE INDEX IF NOT EXISTS idx_anwesenheit_dojo_id 
ON anwesenheit(dojo_id);

-- Mitglied-Relation
CREATE INDEX IF NOT EXISTS idx_anwesenheit_mitglied_id 
ON anwesenheit(mitglied_id);

-- Datum für Statistiken
CREATE INDEX IF NOT EXISTS idx_anwesenheit_datum 
ON anwesenheit(datum);

-- Composite für häufigste Abfrage
CREATE INDEX IF NOT EXISTS idx_anwesenheit_dojo_datum 
ON anwesenheit(dojo_id, datum);

-- =====================================================================================
-- NOTIFICATIONS TABELLE
-- =====================================================================================

-- Multi-Tenancy
CREATE INDEX IF NOT EXISTS idx_notifications_dojo_id 
ON notifications(dojo_id);

-- Empfänger-Filter
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id 
ON notifications(recipient_id);

-- Gelesen/Ungelesen Filter
CREATE INDEX IF NOT EXISTS idx_notifications_gelesen 
ON notifications(gelesen);

-- Datum für chronologische Sortierung
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at);

-- Composite für ungelesene Nachrichten eines Users
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_gelesen 
ON notifications(recipient_id, gelesen);

-- =====================================================================================
-- USERS/ADMINS TABELLE
-- =====================================================================================

-- Email für Login
CREATE INDEX IF NOT EXISTS idx_admins_email 
ON admins(email);

-- Dojo-Zuordnung
CREATE INDEX IF NOT EXISTS idx_admins_dojo_id 
ON admins(dojo_id);

-- Role-basierte Queries
CREATE INDEX IF NOT EXISTS idx_admins_role 
ON admins(role);

-- =====================================================================================
-- FERTIG!
-- =====================================================================================

-- Analyse-Befehl um Index-Nutzung zu prüfen:
-- EXPLAIN SELECT * FROM mitglieder WHERE dojo_id = 1 AND status = 'aktiv';

-- Index-Größen prüfen:
-- SELECT 
--   TABLE_NAME,
--   INDEX_NAME,
--   ROUND(STAT_VALUE * @@innodb_page_size / 1024 / 1024, 2) AS 'Size (MB)'
-- FROM mysql.innodb_index_stats
-- WHERE DATABASE_NAME = 'dojo'
-- ORDER BY STAT_VALUE DESC;
