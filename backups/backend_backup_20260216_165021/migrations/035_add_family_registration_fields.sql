-- Migration 035: Familien-Registrierung Felder
-- Ermöglicht mehrere Familienmitglieder in einem Anmeldevorgang

-- Spalten werden einzeln hinzugefügt - Fehler bei "bereits existiert" werden ignoriert
-- Hinweis: Diese Migration muss ggf. mehrfach ausgeführt werden, bis alle Statements durchlaufen

-- Junction-Tabelle zuerst erstellen (CREATE TABLE IF NOT EXISTS funktioniert)
CREATE TABLE IF NOT EXISTS mitglied_rabatte (
  id INT NOT NULL AUTO_INCREMENT,
  mitglied_id INT NOT NULL,
  rabatt_id INT NOT NULL,
  angewendet_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  entfernt_am TIMESTAMP NULL DEFAULT NULL,
  entfernt_grund VARCHAR(255) DEFAULT NULL,
  aktiv BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (id),
  KEY idx_mitglied_id (mitglied_id),
  KEY idx_rabatt_id (rabatt_id),
  KEY idx_aktiv (aktiv),
  CONSTRAINT fk_mitglied_rabatte_mitglied FOREIGN KEY (mitglied_id)
    REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE,
  CONSTRAINT fk_mitglied_rabatte_rabatt FOREIGN KEY (rabatt_id)
    REFERENCES rabatte(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
