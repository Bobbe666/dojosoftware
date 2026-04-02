CREATE TABLE IF NOT EXISTS zahlungszyklen (
    zyklus_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT 'Name des Zahlungszyklus (z.B. "Monatlich", "Vierteljährlich")',
    intervall_tage INT NOT NULL COMMENT 'Anzahl der Tage zwischen Zahlungen',
    beschreibung TEXT COMMENT 'Detaillierte Beschreibung des Zahlungszyklus',
    aktiv BOOLEAN DEFAULT TRUE COMMENT 'Ist dieser Zahlungszyklus aktiv/verfügbar?',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_aktiv (aktiv),
    INDEX idx_intervall (intervall_tage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Zahlungszyklen für Mitgliedsbeiträge und Tarife';
