-- Migration 028: Ändere CASCADE DELETE zu RESTRICT für Rechnungen
-- Problem: Beim Löschen eines Mitglieds werden alle Rechnungen mitgelöscht
-- Lösung: RESTRICT verhindert das Löschen, wenn noch Rechnungen existieren
--         Rechnungen müssen 10 Jahre aufbewahrt werden (§ 147 AO)

-- 1. Lösche den bestehenden Foreign Key Constraint
ALTER TABLE rechnungen
DROP FOREIGN KEY rechnungen_ibfk_1;

-- 2. Füge den Constraint mit RESTRICT hinzu
-- RESTRICT verhindert das Löschen eines Mitglieds, wenn noch Rechnungen vorhanden sind
ALTER TABLE rechnungen
ADD CONSTRAINT rechnungen_ibfk_1
FOREIGN KEY (mitglied_id)
REFERENCES mitglieder (mitglied_id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Hinweis:
-- Mitglieder mit Rechnungen können nun nicht mehr gelöscht werden
-- Sie müssen archiviert werden (status = 'inaktiv' oder archiviert = 1)
-- Rechnungen bleiben erhalten und können nach 10 Jahren automatisch gelöscht werden
