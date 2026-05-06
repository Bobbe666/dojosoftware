-- Migration 153: Vollständiges Buchhaltungs-Upgrade
-- EÜR + GuV (HGB §275) + Bilanz + UStVA Korrekturantrag
-- ============================================================

-- 1. UStVA-Abgaben-Tracking (Einreichungshistorie)
CREATE TABLE IF NOT EXISTS ustVA_abgaben (
  abgabe_id         INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id           INT NOT NULL,
  organisation_name VARCHAR(100) NOT NULL DEFAULT '',
  jahr              INT NOT NULL,
  zeitraum_art      ENUM('monatlich','vierteljaehrlich') NOT NULL DEFAULT 'monatlich',
  zeitraum_nr       TINYINT NOT NULL,
  kz81              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  kz86              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  kz35              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  kz36              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  kz66              DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  zahllast          DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ist_korrektur     TINYINT(1) NOT NULL DEFAULT 0,
  korrektur_zu_id   INT NULL,
  abgabe_status     ENUM('entwurf','eingereicht','korrektur') NOT NULL DEFAULT 'eingereicht',
  xml_dateiname     VARCHAR(255) NULL,
  eingereicht_am    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eingereicht_von   INT NULL,
  notizen           TEXT NULL,
  INDEX idx_dojo_zeitraum (dojo_id, jahr, zeitraum_art, zeitraum_nr),
  INDEX idx_korrektur     (korrektur_zu_id),
  FOREIGN KEY (korrektur_zu_id) REFERENCES ustVA_abgaben(abgabe_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. bilanz_stammdaten: USt-Schulden-Felder für Passiva
ALTER TABLE bilanz_stammdaten
  ADD COLUMN IF NOT EXISTS ust_schulden         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS ust_schulden_manuell TINYINT(1)    NOT NULL DEFAULT 0;

-- 3. View: Anlagevermögen-Buchwerte auto aus anlage_register + afa_positionen
CREATE OR REPLACE VIEW v_bilanz_anlagevermoegen AS
SELECT
  ar.dojo_id,
  ar.organisation_name,
  ar.anlage_id,
  ar.bezeichnung,
  ar.anlage_kategorie,
  ar.anschaffungskosten,
  COALESCE(
    (SELECT ap.buchwert_ende
     FROM afa_positionen ap
     WHERE ap.anlage_id = ar.anlage_id
       AND ap.afa_jahr <= YEAR(CURDATE())
     ORDER BY ap.afa_jahr DESC
     LIMIT 1),
    ar.anschaffungskosten
  ) AS buchwert_aktuell
FROM anlage_register ar
WHERE ar.aktiv = 1;

-- 4. View: USt-Schulden für Bilanz-Passiva (aus eingereichten UStVA-Meldungen)
CREATE OR REPLACE VIEW v_bilanz_ust_schulden AS
SELECT
  a.dojo_id,
  a.jahr,
  ROUND(SUM(
    CASE WHEN a.ist_korrektur = 0 THEN a.zahllast ELSE 0 END
  ) + COALESCE((
    SELECT SUM(k.zahllast)
    FROM ustVA_abgaben k
    WHERE k.dojo_id = a.dojo_id
      AND k.jahr = a.jahr
      AND k.ist_korrektur = 1
      AND k.korrektur_zu_id IS NOT NULL
  ), 0), 2) AS jahres_zahllast
FROM ustVA_abgaben a
WHERE a.abgabe_status = 'eingereicht'
GROUP BY a.dojo_id, a.jahr;
