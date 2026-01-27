-- Tabelle für Vertragsdokumente (AGB, Datenschutz, Dojokun, etc.)
CREATE TABLE IF NOT EXISTS vertragsdokumente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    dokumenttyp ENUM('agb', 'datenschutz', 'widerruf', 'hausordnung', 'dojokun', 'haftung', 'sonstiges') NOT NULL,
    version VARCHAR(50) NOT NULL,
    titel VARCHAR(255) NOT NULL,
    inhalt TEXT NOT NULL,
    gueltig_ab DATE NOT NULL,
    gueltig_bis DATE NULL,
    aktiv BOOLEAN DEFAULT true,
    erstellt_von INT NULL,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geaendert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dojo_id) REFERENCES dojos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_version (dojo_id, dokumenttyp, version),
    INDEX idx_dojo_typ (dojo_id, dokumenttyp),
    INDEX idx_aktiv (aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
