-- Tabelle für Mahnungen erstellen
CREATE TABLE IF NOT EXISTS mahnungen (
    mahnung_id INT AUTO_INCREMENT PRIMARY KEY,
    beitrag_id INT NOT NULL,
    mahnstufe INT NOT NULL DEFAULT 1,
    mahndatum DATE NOT NULL,
    mahngebuehr DECIMAL(10, 2) DEFAULT 0.00,
    versandt TINYINT(1) DEFAULT 0,
    versand_art VARCHAR(50) DEFAULT 'email',
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (beitrag_id) REFERENCES beitraege(beitrag_id) ON DELETE CASCADE,
    INDEX idx_beitrag (beitrag_id),
    INDEX idx_mahnstufe (mahnstufe),
    INDEX idx_versandt (versandt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
