-- Erstelle Tabelle für Prüfungstermin-Vorlagen (ohne Kandidaten)
CREATE TABLE IF NOT EXISTS pruefungstermin_vorlagen (
  termin_id INT AUTO_INCREMENT PRIMARY KEY,
  pruefungsdatum DATE NOT NULL,
  pruefungszeit TIME DEFAULT '10:00',
  pruefungsort VARCHAR(255),
  stil_id INT NOT NULL,
  pruefungsgebuehr DECIMAL(10, 2),
  anmeldefrist DATE,
  bemerkungen TEXT,
  teilnahmebedingungen TEXT,
  dojo_id INT NOT NULL,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (stil_id) REFERENCES stile(stil_id) ON DELETE CASCADE,
  FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,

  INDEX idx_datum (pruefungsdatum),
  INDEX idx_dojo (dojo_id),
  INDEX idx_stil (stil_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
