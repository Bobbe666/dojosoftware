-- Backup Remote Settings (Alfahosting FTP/SFTP Ziel)
CREATE TABLE IF NOT EXISTS backup_remote_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'Alfahosting',
  protokoll ENUM('ftp','ftps','sftp') DEFAULT 'ftps',
  host VARCHAR(255) NOT NULL DEFAULT '',
  port INT DEFAULT 21,
  benutzername VARCHAR(255) NOT NULL DEFAULT '',
  passwort TEXT NOT NULL DEFAULT '',
  remote_pfad VARCHAR(500) DEFAULT '/backup/',
  aufbewahrung_tage INT DEFAULT 30,
  aktiv TINYINT DEFAULT 1,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Backup Datenbank-Quellen
CREATE TABLE IF NOT EXISTS backup_datenbanken (
  id INT AUTO_INCREMENT PRIMARY KEY,
  anzeigename VARCHAR(100) NOT NULL,
  db_name VARCHAR(100) NOT NULL,
  db_host VARCHAR(100) DEFAULT 'localhost',
  db_user VARCHAR(100) NOT NULL DEFAULT '',
  db_passwort TEXT NOT NULL DEFAULT '',
  aktiv TINYINT DEFAULT 1,
  reihenfolge INT DEFAULT 0,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup Verlauf
CREATE TABLE IF NOT EXISTS backup_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  typ ENUM('manuell','geplant') DEFAULT 'manuell',
  status ENUM('laeuft','erfolg','fehler') DEFAULT 'laeuft',
  gestartet_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  beendet_am TIMESTAMP NULL,
  details JSON,
  fehler_text TEXT,
  groesse_bytes BIGINT DEFAULT 0,
  INDEX idx_status (status),
  INDEX idx_gestartet (gestartet_am)
);

-- Standard-Datenbanken vorbefüllen
INSERT IGNORE INTO backup_datenbanken (anzeigename, db_name, db_host, db_user, db_passwort, reihenfolge) VALUES
  ('Dojosoftware (dojo)',  'dojo', 'localhost', 'dojoUser', '', 1),
  ('TDA Events (tda)',     'tda',  'localhost', 'tdaUser',  '', 2),
  ('Hall of Fame (hof)',   'hof',  'localhost', 'hof_user', '', 3),
  ('TDA Academy',         'tda_academy', 'localhost', 'tdaUser', '', 4);
