-- Migration 196: Businessplan-Modul (Enterprise Feature)
-- ============================================================================
-- Orientiert an der Finanzplanungs-Systematik des Hans-Lindner-Instituts
-- (Investitions-/Finanzierungsplan, AfA, Umsatz-/Mengenplanung, Kostenarten der
-- Rentabilitätsrechnung, Kapitaldienst, Privatentnahmen, Liquidität, 3-Jahres-Plan)
-- erweitert um ein strategisches Ziele-Board und einen PDF-Dokument-Generator.
-- Muster: 058_add_messenger_integration.sql (INFORMATION_SCHEMA-Guard für Spalten).

-- 1. Feature-Flag in dojo_subscriptions
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE() AND table_name='dojo_subscriptions'
     AND column_name='feature_businessplan') = 0,
    'ALTER TABLE dojo_subscriptions ADD COLUMN feature_businessplan BOOLEAN DEFAULT FALSE COMMENT ''Businessplan-Modul (Enterprise)''',
    'SELECT ''feature_businessplan exists'' as info'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Feature-Flag in subscription_plans (Pricing-Matrix)
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema=DATABASE() AND table_name='subscription_plans'
     AND column_name='feature_businessplan') = 0,
    'ALTER TABLE subscription_plans ADD COLUMN feature_businessplan BOOLEAN DEFAULT FALSE',
    'SELECT ''feature_businessplan (plans) exists'' as info'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Enterprise-Plan auf feature_businessplan=TRUE
UPDATE subscription_plans SET feature_businessplan = TRUE WHERE plan_name = 'enterprise';

-- 3b. Bestehende Enterprise-/Trial-Abos sofort freischalten (Trial = volle Testphase)
UPDATE dojo_subscriptions SET feature_businessplan = TRUE WHERE plan_type IN ('enterprise', 'trial');

-- 4. Businessplan-Pläne (oberste Ebene: ein Plan = ein Planungsjahr/Szenario)
CREATE TABLE IF NOT EXISTS businessplan_plaene (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    titel VARCHAR(255) NOT NULL DEFAULT 'Businessplan',
    firmenname VARCHAR(255) NULL,
    rechtsform VARCHAR(100) NULL,
    planungsjahr INT NOT NULL,
    status ENUM('entwurf','aktiv','archiviert') DEFAULT 'entwurf',
    -- Globale Planungsparameter (JSON):
    -- { sozialkostenProzent, steuersatzProzent, erloesschmaelerungProzent,
    --   startLiquiditaet, zahlungszielKundenMonate,
    --   umsatzWachstumJ2, umsatzWachstumJ3, kostenWachstumJ2, kostenWachstumJ3 }
    annahmen JSON NULL,
    -- Freitext-Bausteine fürs Dokument:
    -- { zusammenfassung, gruenderprofil, markt, angebot, marketing, swot, ziele }
    dokument_texte JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id),
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Investitionsplan (Mittelverwendung) + AfA-Basis (Nutzungsdauer → Abschreibung)
CREATE TABLE IF NOT EXISTS businessplan_investitionen (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    plan_id INT NOT NULL,
    kategorie ENUM('grundstuecke','gebaeude','maschinen','einrichtung','fahrzeuge','warenausstattung','sonstiges') DEFAULT 'einrichtung',
    bezeichnung VARCHAR(255) NOT NULL,
    betrag DECIMAL(12,2) NOT NULL DEFAULT 0,
    nutzungsdauer_jahre INT DEFAULT 0,         -- 0 = nicht abschreibbar (z.B. Grundstück, Warenausstattung)
    anschaffung_monat INT DEFAULT 1,           -- 1..12
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id), INDEX idx_plan (plan_id),
    FOREIGN KEY (plan_id) REFERENCES businessplan_plaene(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Finanzierungsplan (Mittelherkunft) inkl. Darlehensparameter für Kapitaldienst
CREATE TABLE IF NOT EXISTS businessplan_finanzierung (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    plan_id INT NOT NULL,
    art ENUM('eigenkapital','sacheinlage','foerdermittel','darlehen','beteiligung','betriebsmittelkredit','kontokorrent') DEFAULT 'eigenkapital',
    bezeichnung VARCHAR(255) NOT NULL,
    betrag DECIMAL(12,2) NOT NULL DEFAULT 0,
    zinssatz_prozent DECIMAL(6,3) DEFAULT 0,   -- nur Darlehen/Kredite
    laufzeit_monate INT DEFAULT 0,
    tilgungsfrei_monate INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id), INDEX idx_plan (plan_id),
    FOREIGN KEY (plan_id) REFERENCES businessplan_plaene(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Umsatzplanung (Produkt/Leistung: Menge × Preis je Einheit, monatlich)
CREATE TABLE IF NOT EXISTS businessplan_umsatz (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    plan_id INT NOT NULL,
    bezeichnung VARCHAR(255) NOT NULL,         -- z.B. Mitgliedschaft, Probetraining, Shop, Lehrgang
    einheit VARCHAR(60) DEFAULT 'Stück',
    menge_monatlich DECIMAL(12,2) DEFAULT 0,
    preis_einheit DECIMAL(12,2) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id), INDEX idx_plan (plan_id),
    FOREIGN KEY (plan_id) REFERENCES businessplan_plaene(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Kostenarten der Rentabilitätsrechnung (Material/Fremdleistung/Personal/Betriebskosten)
CREATE TABLE IF NOT EXISTS businessplan_kosten (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    plan_id INT NOT NULL,
    kategorie ENUM('material','fremdleistung','personal','raumkosten','versicherungen',
                   'kfz','werbung','warenabgabe','reparatur','sonstige_steuern','sonstige') DEFAULT 'sonstige',
    bezeichnung VARCHAR(255) NOT NULL,
    betrag_monatlich DECIMAL(12,2) NOT NULL DEFAULT 0,
    ist_brutto_personal BOOLEAN DEFAULT FALSE, -- bei Personal: Arbeitnehmer-Brutto (Sozialkosten werden aufgeschlagen)
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id), INDEX idx_plan (plan_id),
    FOREIGN KEY (plan_id) REFERENCES businessplan_plaene(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Privatentnahmen (Lebenshaltung, Sonderausgaben, Steuern, Sonstiges) — für Einzelunternehmer
CREATE TABLE IF NOT EXISTS businessplan_privatentnahmen (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    plan_id INT NOT NULL,
    kategorie ENUM('lebenshaltung','sonderausgaben','einkommensteuer','sonstiges') DEFAULT 'lebenshaltung',
    bezeichnung VARCHAR(255) NOT NULL,
    betrag_monatlich DECIMAL(12,2) NOT NULL DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id), INDEX idx_plan (plan_id),
    FOREIGN KEY (plan_id) REFERENCES businessplan_plaene(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Strategische Ziele / KPIs (Ziele-Board)
CREATE TABLE IF NOT EXISTS businessplan_ziele (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    jahr INT NOT NULL,
    titel VARCHAR(255) NOT NULL,
    beschreibung TEXT NULL,
    kpi_name VARCHAR(100) NULL,
    zielwert DECIMAL(14,2) NULL,
    istwert DECIMAL(14,2) NULL DEFAULT 0,
    einheit VARCHAR(40) NULL,
    status ENUM('offen','laeuft','erreicht','verfehlt') DEFAULT 'offen',
    faellig_am DATE NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dojo_jahr (dojo_id, jahr),
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Meilensteine je Ziel
CREATE TABLE IF NOT EXISTS businessplan_meilensteine (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    ziel_id INT NOT NULL,
    titel VARCHAR(255) NOT NULL,
    faellig_am DATE NULL,
    erledigt BOOLEAN DEFAULT FALSE,
    erledigt_am TIMESTAMP NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id), INDEX idx_ziel (ziel_id),
    FOREIGN KEY (ziel_id) REFERENCES businessplan_ziele(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Generierte Businessplan-Dokumente (PDF-Snapshots / Historie)
CREATE TABLE IF NOT EXISTS businessplan_dokumente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dojo_id INT NOT NULL,
    plan_id INT NULL,
    titel VARCHAR(255) NOT NULL DEFAULT 'Businessplan',
    snapshot JSON NULL,
    erstellt_von INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dojo (dojo_id),
    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. plan_features Eintrag für Pricing-Anzeige
INSERT IGNORE INTO plan_features
    (feature_key, feature_name, feature_icon, feature_description, feature_category, sort_order, is_active)
VALUES
    ('businessplan', 'Businessplan & Finanzplanung', '📈',
     'Vollständige Finanz- und Liquiditätsplanung (Investition, Rentabilität, 3-Jahres-Plan), generierbarer Businessplan als PDF für Bank/Förderung und strategisches Ziele-Board',
     'analytics', 95, 1);

-- 14. Enterprise-Plan → businessplan im Feature-Mapping (damit syncPlanFeatures es freischaltet)
INSERT IGNORE INTO plan_feature_mapping (plan_id, feature_id, is_included)
SELECT p.plan_id, f.feature_id, 1
FROM subscription_plans p, plan_features f
WHERE p.plan_name = 'enterprise' AND f.feature_key = 'businessplan';
