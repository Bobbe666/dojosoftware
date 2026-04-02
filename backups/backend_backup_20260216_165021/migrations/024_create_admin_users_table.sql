-- ===================================================================
-- 👥 ADMIN-BENUTZER VERWALTUNGSSYSTEM
-- ===================================================================
-- Diese Migration erstellt die Tabelle für Admin-Benutzer mit
-- differenzierten Zugriffsrechten auf verschiedene Bereiche

-- Admin Users Tabelle
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    vorname VARCHAR(100),
    nachname VARCHAR(100),

    -- Rolle: super_admin, admin, mitarbeiter, eingeschraenkt
    rolle ENUM('super_admin', 'admin', 'mitarbeiter', 'eingeschraenkt') DEFAULT 'eingeschraenkt',

    -- JSON-Feld für spezifische Berechtigungen
    berechtigungen JSON,

    -- Status und Aktivität
    aktiv BOOLEAN DEFAULT TRUE,
    email_verifiziert BOOLEAN DEFAULT FALSE,
    letzter_login TIMESTAMP NULL,
    login_versuche INT DEFAULT 0,
    gesperrt_bis TIMESTAMP NULL,

    -- Session Management
    session_token VARCHAR(255),
    session_ablauf TIMESTAMP NULL,

    -- Password Reset
    reset_token VARCHAR(255),
    reset_token_ablauf TIMESTAMP NULL,

    -- Audit Trail
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    erstellt_von INT,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    aktualisiert_von INT,

    -- Indexes
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_rolle (rolle),
    INDEX idx_aktiv (aktiv),
    INDEX idx_session_token (session_token),
    INDEX idx_letzter_login (letzter_login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================================
-- 📋 BERECHTIGUNGSSTRUKTUR
-- ===================================================================
-- Das JSON-Feld "berechtigungen" hat folgende Struktur:
-- {
--   "mitglieder": { "lesen": true, "erstellen": true, "bearbeiten": true, "loeschen": false },
--   "vertraege": { "lesen": true, "erstellen": true, "bearbeiten": true, "loeschen": false },
--   "finanzen": { "lesen": true, "erstellen": false, "bearbeiten": false, "loeschen": false },
--   "pruefungen": { "lesen": true, "erstellen": true, "bearbeiten": true, "loeschen": false },
--   "stundenplan": { "lesen": true, "erstellen": true, "bearbeiten": true, "loeschen": false },
--   "einstellungen": { "lesen": true, "erstellen": false, "bearbeiten": true, "loeschen": false },
--   "admins": { "lesen": false, "erstellen": false, "bearbeiten": false, "loeschen": false },
--   "dashboard": { "lesen": true },
--   "berichte": { "lesen": true, "exportieren": false }
-- }

-- ===================================================================
-- 👤 STANDARD SUPER-ADMIN ERSTELLEN
-- ===================================================================
-- WICHTIG: Passwort muss nach dem ersten Login geändert werden!
-- Default-Passwort: "admin123" (SHA-256 Hash)
-- Bitte sofort nach dem ersten Login ändern!

INSERT INTO admin_users (
    username,
    email,
    password,
    vorname,
    nachname,
    rolle,
    berechtigungen,
    aktiv,
    email_verifiziert
) VALUES (
    'admin',
    'admin@dojo.local',
    -- Passwort: admin123 (muss geändert werden!)
    '$2b$10$YourHashedPasswordHere',
    'System',
    'Administrator',
    'super_admin',
    JSON_OBJECT(
        'mitglieder', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'vertraege', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'finanzen', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'pruefungen', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'stundenplan', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'einstellungen', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'admins', JSON_OBJECT('lesen', TRUE, 'erstellen', TRUE, 'bearbeiten', TRUE, 'loeschen', TRUE),
        'dashboard', JSON_OBJECT('lesen', TRUE),
        'berichte', JSON_OBJECT('lesen', TRUE, 'exportieren', TRUE)
    ),
    TRUE,
    TRUE
) ON DUPLICATE KEY UPDATE id = id;

-- ===================================================================
-- 📊 AUDIT LOG TABELLE FÜR ADMIN-AKTIONEN
-- ===================================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    aktion VARCHAR(100) NOT NULL,
    bereich VARCHAR(50) NOT NULL,
    beschreibung TEXT,
    betroffene_entity_type VARCHAR(50),
    betroffene_entity_id INT,

    -- Weitere Details
    ip_adresse VARCHAR(45),
    user_agent TEXT,

    -- Zeitstempel
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key
    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_admin_id (admin_id),
    INDEX idx_aktion (aktion),
    INDEX idx_bereich (bereich),
    INDEX idx_erstellt_am (erstellt_am),
    INDEX idx_entity (betroffene_entity_type, betroffene_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================================
-- 🔐 HINWEIS: TRIGGER UND EVENTS
-- ===================================================================
-- Trigger und Events werden später über das Backend-API verwaltet
-- oder können manuell über die MySQL CLI hinzugefügt werden

-- ===================================================================
-- ✅ MIGRATION ABGESCHLOSSEN
-- ===================================================================
