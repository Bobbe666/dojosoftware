-- Shop Bestellungen System für TDA International
-- Verbandsmitglieder können im Shop bestellen

-- Bestellungen Haupttabelle
CREATE TABLE IF NOT EXISTS shop_bestellungen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bestellnummer VARCHAR(50) NOT NULL UNIQUE,
  verbandsmitgliedschaft_id INT NOT NULL,

  -- Kundendaten (zum Zeitpunkt der Bestellung)
  kunde_name VARCHAR(255) NOT NULL,
  kunde_email VARCHAR(255) NOT NULL,
  kunde_telefon VARCHAR(50),

  -- Lieferadresse
  lieferadresse_strasse VARCHAR(255),
  lieferadresse_plz VARCHAR(20),
  lieferadresse_ort VARCHAR(100),
  lieferadresse_land VARCHAR(100) DEFAULT 'Deutschland',

  -- Beträge
  zwischensumme_cent INT NOT NULL DEFAULT 0,
  versandkosten_cent INT NOT NULL DEFAULT 0,
  gesamtbetrag_cent INT NOT NULL DEFAULT 0,

  -- Status
  status ENUM('offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert') DEFAULT 'offen',

  -- Tracking
  tracking_nummer VARCHAR(100),
  versanddienstleister VARCHAR(100),

  -- Notizen
  kundennotiz TEXT,
  interne_notiz TEXT,

  -- Timestamps
  bestellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bearbeitet_am TIMESTAMP NULL,
  versendet_am TIMESTAMP NULL,
  abgeschlossen_am TIMESTAMP NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (verbandsmitgliedschaft_id) REFERENCES verbandsmitgliedschaften(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_bestellt_am (bestellt_am),
  INDEX idx_verbandsmitgliedschaft (verbandsmitgliedschaft_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bestellpositionen
CREATE TABLE IF NOT EXISTS shop_bestellpositionen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bestellung_id INT NOT NULL,
  artikel_id INT NOT NULL,

  -- Artikeldaten (zum Zeitpunkt der Bestellung)
  artikel_name VARCHAR(255) NOT NULL,
  artikel_beschreibung TEXT,

  -- Variante (falls vorhanden)
  variante VARCHAR(100),

  -- Mengen und Preise
  menge INT NOT NULL DEFAULT 1,
  einzelpreis_cent INT NOT NULL,
  gesamtpreis_cent INT NOT NULL,
  mwst_prozent DECIMAL(5,2) DEFAULT 19.00,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (bestellung_id) REFERENCES shop_bestellungen(id) ON DELETE CASCADE,
  FOREIGN KEY (artikel_id) REFERENCES artikel(artikel_id) ON DELETE RESTRICT,
  INDEX idx_bestellung (bestellung_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
