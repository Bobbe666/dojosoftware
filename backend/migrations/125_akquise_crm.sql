-- ============================================================================
-- Migration 125: Akquise CRM
-- Verwaltet Kontakte (Schulen/Verbände) für die Mitglieder-Akquise
-- inkl. Aktivitätenprotokoll und E-Mail-/Briefversand-Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS akquise_kontakte (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Organisation
  organisation VARCHAR(255) NOT NULL                    COMMENT 'Name der Schule / des Verbands',
  typ ENUM('schule','verband','verein','sonstige') DEFAULT 'schule',
  ansprechpartner VARCHAR(255),
  position VARCHAR(100)                                 COMMENT 'z.B. Schulleiter, 1. Vorsitzender',
  email VARCHAR(255),
  telefon VARCHAR(50),
  webseite VARCHAR(500),
  -- Adresse
  strasse VARCHAR(255),
  plz VARCHAR(10),
  ort VARCHAR(100),
  land VARCHAR(100) DEFAULT 'Deutschland',
  -- Kampfkunst-Details
  sportart VARCHAR(255)                                 COMMENT 'z.B. Karate, Taekwondo, Kickboxing',
  mitglieder_anzahl INT                                 COMMENT 'Geschätzte Mitgliederzahl',
  gegruendet_jahr INT,
  -- Pipeline-Status
  status ENUM('neu','kontaktiert','interessiert','angebot','gewonnen','abgelehnt','pausiert') DEFAULT 'neu',
  prioritaet ENUM('hoch','mittel','niedrig') DEFAULT 'mittel',
  quelle ENUM('manuell','tda_events','empfehlung','messe','internet','sonstige') DEFAULT 'manuell',
  -- Verbandsstatus (nach Gewinn)
  verbandsmitgliedschaft_id INT                         COMMENT 'Verknüpfung nach erfolgreicher Aufnahme',
  -- TDA-Events-Referenz
  tda_vereins_id INT                                    COMMENT 'ID in TDA-Events Vereine-Tabelle',
  -- Follow-up
  naechste_aktion DATE,
  naechste_aktion_info VARCHAR(500),
  zustaendig_user_id INT,
  -- Meta
  notiz TEXT,
  tags VARCHAR(1000)                                    COMMENT 'JSON-Array mit Tags',
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS akquise_aktivitaeten (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kontakt_id INT NOT NULL,
  datum TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  art ENUM('email','brief','telefon','persoenlich','nachricht','sonstiges') NOT NULL,
  -- Inhalt
  betreff VARCHAR(500),
  inhalt MEDIUMTEXT                                     COMMENT 'E-Mail-HTML oder Brieftext',
  vorlage_name VARCHAR(255)                             COMMENT 'Name der genutzten Vorlage',
  -- Ergebnis
  ergebnis ENUM('ausstehend','positiv','negativ','keine_antwort') DEFAULT 'ausstehend',
  ergebnis_datum DATE,
  ergebnis_notiz TEXT,
  -- Status-Änderung die diese Aktivität ausgelöst hat
  status_vorher VARCHAR(50),
  status_nachher VARCHAR(50),
  -- Meta
  erstellt_von_user_id INT,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kontakt_id) REFERENCES akquise_kontakte(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indizes
CREATE INDEX idx_akquise_kontakte_status    ON akquise_kontakte(status);
CREATE INDEX idx_akquise_kontakte_typ       ON akquise_kontakte(typ);
CREATE INDEX idx_akquise_kontakte_prio      ON akquise_kontakte(prioritaet);
CREATE INDEX idx_akquise_kontakte_aktion    ON akquise_kontakte(naechste_aktion);
CREATE INDEX idx_akquise_aktivitaeten_kont  ON akquise_aktivitaeten(kontakt_id);
CREATE INDEX idx_akquise_aktivitaeten_art   ON akquise_aktivitaeten(art);
CREATE INDEX idx_akquise_aktivitaeten_erg   ON akquise_aktivitaeten(ergebnis);

CREATE TABLE IF NOT EXISTS akquise_vorlagen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  typ ENUM('email','brief') DEFAULT 'email',
  kategorie VARCHAR(100) DEFAULT 'sonstiges'   COMMENT 'erstanschreiben, folgeanschreiben, angebot, willkommen, ...',
  betreff VARCHAR(500),
  html MEDIUMTEXT NOT NULL,
  aktiv TINYINT(1) DEFAULT 1,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
