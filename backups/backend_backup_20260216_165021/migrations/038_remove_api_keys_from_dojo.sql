-- Migration: Entferne API-Keys aus der dojo Tabelle
-- SICHERHEIT: API-Keys gehören in Environment-Variablen, nicht in die Datenbank!
-- Datum: 2026-01-26

-- Schritt 1: Erstelle Backup-Tabelle mit alten Keys (für Notfall)
CREATE TABLE IF NOT EXISTS _backup_dojo_api_keys_20260126 (
    dojo_id INT PRIMARY KEY,
    stripe_secret_key VARCHAR(255),
    stripe_publishable_key VARCHAR(255),
    datev_api_key VARCHAR(255),
    backup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schritt 2: Sichere bestehende Keys (falls vorhanden)
INSERT IGNORE INTO _backup_dojo_api_keys_20260126 (dojo_id, stripe_secret_key, stripe_publishable_key, datev_api_key)
SELECT id, stripe_secret_key, stripe_publishable_key, datev_api_key
FROM dojo
WHERE stripe_secret_key IS NOT NULL 
   OR stripe_publishable_key IS NOT NULL 
   OR datev_api_key IS NOT NULL;

-- Schritt 3: Setze die Spalten auf NULL (Keys sind jetzt in .env)
UPDATE dojo SET 
    stripe_secret_key = NULL,
    stripe_publishable_key = NULL,
    datev_api_key = NULL;

-- Schritt 4: Optional - Spalten komplett entfernen (auskommentiert für Sicherheit)
-- Falls gewünscht, manuell ausführen nach Verifizierung:
-- ALTER TABLE dojo DROP COLUMN stripe_secret_key;
-- ALTER TABLE dojo DROP COLUMN stripe_publishable_key;
-- ALTER TABLE dojo DROP COLUMN datev_api_key;

-- Schritt 5: Log-Eintrag
INSERT INTO payment_provider_logs (dojo_id, provider, action, status, message)
SELECT id, payment_provider, 'security_migration', 'success', 
       'API-Keys aus Datenbank entfernt und in Environment-Variablen verschoben'
FROM dojo
WHERE id = 2;
