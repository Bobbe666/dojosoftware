-- =============================================================================
-- Migration 039: Verband Urkundenregister
-- Speichert Prüfungsurkunden, DAN-Urkunden, Trainer-/Kampfrichter-Lizenzen etc.
-- =============================================================================

CREATE TABLE IF NOT EXISTS verband_urkunden (
  id                  INT AUTO_INCREMENT PRIMARY KEY,

  -- Urkunden-Identifikation
  urkundennummer      VARCHAR(60)  NULL UNIQUE COMMENT 'z.B. TDA-DAN-2026-0001 (auto) oder eigene Nummer',
  art                 ENUM(
                        'pruefungsurkunde',
                        'dan_urkunde',
                        'ehren_dan',
                        'trainer_lizenz',
                        'kampfrichter_lizenz',
                        'meister_urkunde',
                        'sonstiges'
                      ) NOT NULL DEFAULT 'pruefungsurkunde',

  -- Person
  vorname             VARCHAR(100) NOT NULL,
  nachname            VARCHAR(100) NOT NULL,
  geburtsdatum        DATE         NULL,
  email               VARCHAR(255) NULL,
  telefon             VARCHAR(50)  NULL,

  -- Vollständige Adresse
  strasse             VARCHAR(255) NULL,
  plz                 VARCHAR(10)  NULL,
  ort                 VARCHAR(100) NULL,
  land                VARCHAR(100) NOT NULL DEFAULT 'Deutschland',

  -- Inhalt der Urkunde / Lizenz
  grad                VARCHAR(80)  NULL COMMENT 'z.B. 1. Dan, 3. Kyu, 4. Dan',
  disziplin           VARCHAR(100) NULL COMMENT 'z.B. Karate, Judo, Taekwondo',

  -- Ausstellung
  ausstellungsdatum   DATE         NOT NULL,
  ausgestellt_von     VARCHAR(255) NULL COMMENT 'Name des Ausstellers / Unterzeichners',
  dojo_schule         VARCHAR(255) NULL COMMENT 'Dojo oder Schule des Kandidaten',

  -- Zusatz
  notizen             TEXT         NULL,

  -- Audit
  erstellt_von_user_id INT         NULL,
  erstellt_am         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  geaendert_am        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_nachname         (nachname),
  INDEX idx_vorname          (vorname),
  INDEX idx_art              (art),
  INDEX idx_ausstellungsdatum (ausstellungsdatum),
  INDEX idx_grad             (grad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Urkundenregister des TDA International Verbands';
