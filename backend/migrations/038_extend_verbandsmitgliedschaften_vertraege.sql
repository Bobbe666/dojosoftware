-- ============================================================================
-- Migration 038: Erweiterte Verbandsmitgliedschaften mit Verträgen
-- Vertragsmanagement, AGB/DSGVO, SEPA-Mandate, Rechtssichere Dokumentation
-- ============================================================================

-- Verbandsmitgliedschaften erweitern um Vertragsfelder
ALTER TABLE verbandsmitgliedschaften
  ADD COLUMN IF NOT EXISTS vertrag_pdf_path VARCHAR(500) NULL AFTER notizen,
  ADD COLUMN IF NOT EXISTS vertrag_erstellt_am DATETIME NULL AFTER vertrag_pdf_path,
  ADD COLUMN IF NOT EXISTS vertrag_unterschrieben_am DATETIME NULL AFTER vertrag_erstellt_am,
  ADD COLUMN IF NOT EXISTS unterschrift_digital LONGTEXT NULL AFTER vertrag_unterschrieben_am,
  ADD COLUMN IF NOT EXISTS unterschrift_ip VARCHAR(45) NULL AFTER unterschrift_digital,
  ADD COLUMN IF NOT EXISTS unterschrift_hash VARCHAR(64) NULL AFTER unterschrift_ip,

  -- AGB/DSGVO Zustimmung
  ADD COLUMN IF NOT EXISTS agb_akzeptiert TINYINT(1) DEFAULT 0 AFTER unterschrift_hash,
  ADD COLUMN IF NOT EXISTS agb_akzeptiert_am DATETIME NULL AFTER agb_akzeptiert,
  ADD COLUMN IF NOT EXISTS agb_version VARCHAR(20) NULL AFTER agb_akzeptiert_am,
  ADD COLUMN IF NOT EXISTS dsgvo_akzeptiert TINYINT(1) DEFAULT 0 AFTER agb_version,
  ADD COLUMN IF NOT EXISTS dsgvo_akzeptiert_am DATETIME NULL AFTER dsgvo_akzeptiert,
  ADD COLUMN IF NOT EXISTS dsgvo_version VARCHAR(20) NULL AFTER dsgvo_akzeptiert_am,
  ADD COLUMN IF NOT EXISTS widerrufsrecht_akzeptiert TINYINT(1) DEFAULT 0 AFTER dsgvo_version,
  ADD COLUMN IF NOT EXISTS widerrufsrecht_akzeptiert_am DATETIME NULL AFTER widerrufsrecht_akzeptiert,

  -- Erweiterte Kontaktdaten für Einzelpersonen
  ADD COLUMN IF NOT EXISTS person_firma VARCHAR(255) NULL AFTER person_geburtsdatum,
  ADD COLUMN IF NOT EXISTS person_position VARCHAR(100) NULL AFTER person_firma,

  -- Kommunikation
  ADD COLUMN IF NOT EXISTS kommunikation_email TINYINT(1) DEFAULT 1 AFTER person_position,
  ADD COLUMN IF NOT EXISTS kommunikation_post TINYINT(1) DEFAULT 0 AFTER kommunikation_email,
  ADD COLUMN IF NOT EXISTS newsletter TINYINT(1) DEFAULT 0 AFTER kommunikation_post;

-- Verband SEPA Mandate Tabelle
CREATE TABLE IF NOT EXISTS verband_sepa_mandate (
    id INT AUTO_INCREMENT PRIMARY KEY,
    verbandsmitgliedschaft_id INT NOT NULL,

    -- Mandatsdaten
    mandatsreferenz VARCHAR(35) NOT NULL UNIQUE,
    mandatstyp ENUM('CORE', 'B2B') DEFAULT 'CORE',
    sequenztyp ENUM('FRST', 'RCUR', 'OOFF', 'FNAL') DEFAULT 'RCUR',

    -- Kontodaten
    iban VARCHAR(34) NOT NULL,
    bic VARCHAR(11) NULL,
    kontoinhaber VARCHAR(100) NOT NULL,

    -- Mandatsstatus
    status ENUM('aktiv', 'inaktiv', 'gesperrt', 'widerrufen') DEFAULT 'aktiv',
    unterschriftsdatum DATE NOT NULL,
    gueltig_ab DATE NOT NULL,
    gueltig_bis DATE NULL,

    -- Digitale Unterschrift
    unterschrift_digital LONGTEXT NULL,
    unterschrift_ip VARCHAR(45) NULL,
    unterschrift_hash VARCHAR(64) NULL,

    -- Letzte Nutzung
    letzte_lastschrift DATE NULL,
    anzahl_lastschriften INT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_verbandsmitgliedschaft_id (verbandsmitgliedschaft_id),
    INDEX idx_status (status),
    INDEX idx_mandatsreferenz (mandatsreferenz)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verband Dokumente (AGB, DSGVO, Widerrufsbelehrung)
CREATE TABLE IF NOT EXISTS verband_dokumente (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Dokumenttyp
    typ ENUM('agb', 'dsgvo', 'widerrufsbelehrung', 'satzung', 'beitragsordnung') NOT NULL,

    -- Version
    version VARCHAR(20) NOT NULL,
    gueltig_ab DATE NOT NULL,
    gueltig_bis DATE NULL,

    -- Inhalt
    titel VARCHAR(255) NOT NULL,
    inhalt LONGTEXT NOT NULL,

    -- Status
    aktiv TINYINT(1) DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_typ (typ),
    INDEX idx_version (version),
    INDEX idx_aktiv (aktiv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verband Dokumenten-Akzeptanz (welches Mitglied hat welche Version akzeptiert)
CREATE TABLE IF NOT EXISTS verband_dokument_akzeptanz (
    id INT AUTO_INCREMENT PRIMARY KEY,
    verbandsmitgliedschaft_id INT NOT NULL,
    dokument_id INT NOT NULL,

    -- Akzeptanz-Details
    akzeptiert_am DATETIME NOT NULL,
    ip_adresse VARCHAR(45) NULL,
    user_agent TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_verbandsmitgliedschaft_id (verbandsmitgliedschaft_id),
    INDEX idx_dokument_id (dokument_id),
    UNIQUE KEY unique_akzeptanz (verbandsmitgliedschaft_id, dokument_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verband Vertragshistorie (alle Änderungen protokollieren)
CREATE TABLE IF NOT EXISTS verband_vertragshistorie (
    id INT AUTO_INCREMENT PRIMARY KEY,
    verbandsmitgliedschaft_id INT NOT NULL,

    -- Was wurde geändert
    aktion ENUM('erstellt', 'verlaengert', 'geaendert', 'gekuendigt', 'reaktiviert', 'sepa_angelegt', 'sepa_geaendert', 'zahlung') NOT NULL,

    -- Details
    beschreibung TEXT NULL,
    alte_werte JSON NULL,
    neue_werte JSON NULL,

    -- Wer hat geändert
    durchgefuehrt_von VARCHAR(100) NULL,
    ip_adresse VARCHAR(45) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_verbandsmitgliedschaft_id (verbandsmitgliedschaft_id),
    INDEX idx_aktion (aktion),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard-Dokumente einfügen
INSERT INTO verband_dokumente (typ, version, gueltig_ab, titel, inhalt, aktiv) VALUES
('agb', '1.0', CURDATE(), 'Allgemeine Geschäftsbedingungen TDA International', '
<h2>Allgemeine Geschäftsbedingungen</h2>
<h3>Tiger & Dragon Association International</h3>

<h4>§ 1 Geltungsbereich</h4>
<p>Diese Allgemeinen Geschäftsbedingungen gelten für alle Mitgliedschaften bei der Tiger & Dragon Association International (nachfolgend "TDA" genannt).</p>

<h4>§ 2 Mitgliedschaft</h4>
<p>(1) Die Mitgliedschaft in der TDA steht Kampfkunstschulen (Dojo-Mitgliedschaft) sowie Einzelpersonen (Einzelmitgliedschaft) offen.</p>
<p>(2) Der Mitgliedschaftsvertrag kommt durch Annahme des Antrags durch die TDA zustande.</p>
<p>(3) Die Mitgliedschaft beginnt mit dem im Vertrag genannten Datum.</p>

<h4>§ 3 Beiträge</h4>
<p>(1) Der Jahresbeitrag für Dojo-Mitgliedschaften beträgt 99,00 EUR.</p>
<p>(2) Der Jahresbeitrag für Einzelmitgliedschaften beträgt 49,00 EUR.</p>
<p>(3) Der Beitrag ist jährlich im Voraus fällig.</p>
<p>(4) Bei SEPA-Lastschrift erfolgt der Einzug automatisch zum Fälligkeitsdatum.</p>

<h4>§ 4 Leistungen</h4>
<p>Die Mitgliedschaft berechtigt zu:</p>
<ul>
<li>Ermäßigten Startgebühren bei TDA-Turnieren</li>
<li>Vergünstigten Seminargebühren</li>
<li>Reduzierten Prüfungsgebühren</li>
<li>Rabatten im TDA-Shop</li>
<li>Nutzung des TDA-Logos und der Verbandszugehörigkeit</li>
</ul>

<h4>§ 5 Laufzeit und Kündigung</h4>
<p>(1) Die Mitgliedschaft wird für ein Jahr abgeschlossen.</p>
<p>(2) Sie verlängert sich automatisch um ein weiteres Jahr, wenn sie nicht mit einer Frist von 3 Monaten zum Vertragsende schriftlich gekündigt wird.</p>
<p>(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</p>

<h4>§ 6 Datenschutz</h4>
<p>Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer Datenschutzerklärung und den geltenden Datenschutzgesetzen.</p>

<h4>§ 7 Schlussbestimmungen</h4>
<p>(1) Es gilt das Recht der Bundesrepublik Deutschland.</p>
<p>(2) Gerichtsstand ist der Sitz der TDA.</p>
<p>(3) Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>

<p><strong>Stand:</strong> Januar 2026</p>
', 1),

('dsgvo', '1.0', CURDATE(), 'Datenschutzerklärung TDA International', '
<h2>Datenschutzerklärung</h2>
<h3>Tiger & Dragon Association International</h3>

<h4>1. Verantwortlicher</h4>
<p>Verantwortlich für die Datenverarbeitung ist die Tiger & Dragon Association International.</p>

<h4>2. Erhobene Daten</h4>
<p>Wir erheben und verarbeiten folgende personenbezogene Daten:</p>
<ul>
<li>Name, Vorname</li>
<li>Anschrift</li>
<li>E-Mail-Adresse</li>
<li>Telefonnummer</li>
<li>Geburtsdatum</li>
<li>Bankverbindung (bei SEPA-Lastschrift)</li>
<li>Dojo-Zugehörigkeit</li>
</ul>

<h4>3. Zweck der Verarbeitung</h4>
<p>Die Daten werden verarbeitet für:</p>
<ul>
<li>Abwicklung des Mitgliedschaftsverhältnisses</li>
<li>Beitragseinzug</li>
<li>Kommunikation mit Mitgliedern</li>
<li>Turnier- und Seminarorganisation</li>
<li>Statistiken (anonymisiert)</li>
</ul>

<h4>4. Rechtsgrundlage</h4>
<p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).</p>

<h4>5. Speicherdauer</h4>
<p>Die Daten werden für die Dauer der Mitgliedschaft und darüber hinaus gemäß den gesetzlichen Aufbewahrungsfristen (bis zu 10 Jahre) gespeichert.</p>

<h4>6. Ihre Rechte</h4>
<p>Sie haben das Recht auf:</p>
<ul>
<li>Auskunft über Ihre gespeicherten Daten</li>
<li>Berichtigung unrichtiger Daten</li>
<li>Löschung (soweit keine Aufbewahrungspflichten bestehen)</li>
<li>Einschränkung der Verarbeitung</li>
<li>Datenübertragbarkeit</li>
<li>Widerspruch gegen die Verarbeitung</li>
<li>Beschwerde bei der Aufsichtsbehörde</li>
</ul>

<h4>7. Kontakt</h4>
<p>Bei Fragen zum Datenschutz wenden Sie sich an: datenschutz@tda-intl.org</p>

<p><strong>Stand:</strong> Januar 2026</p>
', 1),

('widerrufsbelehrung', '1.0', CURDATE(), 'Widerrufsbelehrung TDA International', '
<h2>Widerrufsbelehrung</h2>

<h4>Widerrufsrecht</h4>
<p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>

<p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.</p>

<p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns</p>
<p><strong>Tiger & Dragon Association International</strong><br>
E-Mail: info@tda-intl.org</p>

<p>mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p>

<h4>Folgen des Widerrufs</h4>
<p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.</p>

<p>Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart.</p>

<p>Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.</p>

<p><strong>Stand:</strong> Januar 2026</p>
', 1),

('beitragsordnung', '1.0', CURDATE(), 'Beitragsordnung TDA International', '
<h2>Beitragsordnung</h2>
<h3>Tiger & Dragon Association International</h3>

<h4>§ 1 Mitgliedsbeiträge</h4>
<table border="1" cellpadding="10">
<tr><th>Mitgliedschaftsart</th><th>Jahresbeitrag</th></tr>
<tr><td>Dojo-Mitgliedschaft</td><td>99,00 EUR</td></tr>
<tr><td>Einzelmitgliedschaft</td><td>49,00 EUR</td></tr>
</table>

<h4>§ 2 Fälligkeit</h4>
<p>(1) Der Jahresbeitrag ist zum Beginn des Mitgliedschaftsjahres fällig.</p>
<p>(2) Bei Neuaufnahme ist der Beitrag innerhalb von 14 Tagen nach Vertragsabschluss zu entrichten.</p>

<h4>§ 3 Zahlungsarten</h4>
<p>Folgende Zahlungsarten werden akzeptiert:</p>
<ul>
<li>SEPA-Lastschrift (empfohlen)</li>
<li>Überweisung</li>
<li>PayPal</li>
</ul>

<h4>§ 4 Mitgliedsvorteile</h4>
<table border="1" cellpadding="10">
<tr><th>Vorteil</th><th>Dojo-Mitglieder</th><th>Einzelmitglieder</th></tr>
<tr><td>Turnier-Startgebühren</td><td>20% Rabatt</td><td>15% Rabatt</td></tr>
<tr><td>Seminargebühren</td><td>15% Rabatt</td><td>10% Rabatt</td></tr>
<tr><td>Prüfungsgebühren</td><td>10% Rabatt</td><td>-</td></tr>
<tr><td>TDA-Shop</td><td>10% Rabatt</td><td>10% Rabatt</td></tr>
</table>

<h4>§ 5 Mahnwesen</h4>
<p>(1) Bei Zahlungsverzug wird eine Mahnung versandt.</p>
<p>(2) Ab der zweiten Mahnung werden Mahngebühren von 5,00 EUR erhoben.</p>
<p>(3) Rücklastschriftgebühren werden in Höhe von 10,00 EUR berechnet.</p>

<p><strong>Stand:</strong> Januar 2026</p>
', 1);
