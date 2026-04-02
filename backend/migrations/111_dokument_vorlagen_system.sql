-- ============================================================================
-- Migration 111: Dokument-Vorlagen-System
-- Absender-Profile (Dojo / Verband / Lizenzen) + Vorlagen mit WYSIWYG-Content
-- ============================================================================

-- ── Absender-Profile (eigene Briefköpfe je Kontext) ──────────────────────────
CREATE TABLE IF NOT EXISTS absender_profile (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NULL COMMENT 'NULL = globales System-Profil',
  typ ENUM('dojo', 'verband', 'lizenzen') NOT NULL DEFAULT 'dojo',
  name VARCHAR(255) NOT NULL COMMENT 'Anzeigename des Profils',
  organisation VARCHAR(255) COMMENT 'Offizieller Organisationsname',
  inhaber VARCHAR(255) COMMENT 'Unterzeichner / Inhaber (für Signaturzeile)',
  strasse VARCHAR(255),
  hausnummer VARCHAR(20),
  plz VARCHAR(10),
  ort VARCHAR(255),
  land VARCHAR(100) DEFAULT 'Deutschland',
  telefon VARCHAR(100),
  email VARCHAR(255),
  internet VARCHAR(255),
  bank_name VARCHAR(255),
  bank_iban VARCHAR(50),
  bank_bic VARCHAR(20),
  bank_inhaber VARCHAR(255),
  logo_url VARCHAR(500) COMMENT 'URL zum Logo (Base64 oder absoluter Pfad)',
  farbe_primaer VARCHAR(20) DEFAULT '#8B0000' COMMENT 'Briefkopf-Farbe (HEX)',
  aktiv TINYINT DEFAULT 1,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_typ (typ)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Dokument-Vorlagen ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dokument_vorlagen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dojo_id INT NULL COMMENT 'NULL = System-Vorlage für alle Dojos',
  absender_profil_id INT NULL COMMENT 'Referenz auf absender_profile.id',
  system_vorlage TINYINT DEFAULT 0 COMMENT '1 = eingebaut, schreibgeschützt, nur kopierbar',
  kategorie ENUM(
    'begruessung',
    'geburtstag',
    'kuendigung_bestaetigung',
    'ruhezeit',
    'zahlungserinnerung',
    'mahnung',
    'mahnbescheid',
    'ruecklastschrift_info',
    'kursanmeldung',
    'pruefung_einladung',
    'pruefung_ergebnis',
    'guertelvergabe',
    'lizenz_ausstellung',
    'lizenz_verlaengerung',
    'verband_info',
    'info_brief',
    'rundschreiben',
    'sonstiges'
  ) NOT NULL DEFAULT 'sonstiges',
  name VARCHAR(255) NOT NULL,
  email_betreff VARCHAR(500) COMMENT 'Betreff für Email-Versand',
  email_html TEXT COMMENT 'TipTap HTML-Output für Email-Body',
  brief_titel VARCHAR(255) COMMENT 'Betreffzeile im PDF-Brief',
  brief_html TEXT COMMENT 'TipTap HTML-Output für PDF-Briefkörper',
  mit_pdf_anhang TINYINT DEFAULT 0 COMMENT 'Bei Email-Versand automatisch PDF-Brief anhängen',
  aktiv TINYINT DEFAULT 1,
  erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id),
  INDEX idx_kategorie (kategorie),
  INDEX idx_system (system_vorlage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Standard-Vorlagen (system_vorlage=1, dojo_id=NULL) ───────────────────────

INSERT INTO dokument_vorlagen (dojo_id, system_vorlage, kategorie, name, email_betreff, email_html, brief_titel, brief_html, mit_pdf_anhang) VALUES

-- 1. Begrüßungsschreiben
(NULL, 1, 'begruessung', 'Willkommensschreiben neues Mitglied',
 'Herzlich Willkommen bei {{absender_name}}!',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>herzlich willkommen bei uns! Wir freuen uns sehr, Sie als neues Mitglied begrüßen zu dürfen.</p><p>Ihre Mitgliedsnummer lautet: <strong>{{mitgliedsnummer}}</strong>.</p><p>Bei Fragen stehen wir Ihnen gerne unter <a href="mailto:{{absender_email}}">{{absender_email}}</a> oder {{absender_telefon}} zur Verfügung.</p><p>Wir freuen uns auf eine gute gemeinsame Zeit!</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 'Herzlich Willkommen!',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>herzlich willkommen bei <strong>{{absender_name}}</strong>! Wir freuen uns sehr, Sie als neues Mitglied begrüßen zu dürfen.</p><p>Ihre Mitgliedsnummer lautet: <strong>{{mitgliedsnummer}}</strong>.</p><p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 0),

-- 2. Geburtstagsgratulation
(NULL, 1, 'geburtstag', 'Geburtstagsgratulation',
 'Herzlichen Glückwunsch zum Geburtstag, {{vorname}}!',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>zu Ihrem Geburtstag gratulieren wir Ihnen herzlich und wünschen Ihnen alles Gute, Gesundheit und viel Erfolg beim Training!</p><p>Mit freundlichen Grüßen<br>Ihr {{absender_name}}-Team</p>',
 'Herzlichen Glückwunsch!',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>zu Ihrem Geburtstag gratulieren wir Ihnen herzlich!</p><p>Wir wünschen Ihnen alles Gute, beste Gesundheit und weiterhin viel Freude und Erfolg beim Training.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0),

-- 3. Kündigungs-Bestätigung
(NULL, 1, 'kuendigung_bestaetigung', 'Kündigung Bestätigung',
 'Bestätigung Ihrer Kündigung — {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen hiermit den Eingang Ihrer Kündigung. Ihre Mitgliedschaft endet zum <strong>{{kuendigungsdatum}}</strong>.</p><p>Wir bedauern, Sie als Mitglied zu verlieren, und hoffen, Sie vielleicht zu einem späteren Zeitpunkt wieder begrüßen zu dürfen.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Bestätigung Ihrer Kündigung',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen den Eingang Ihrer Kündigung Ihrer Mitgliedschaft (Nr. {{mitgliedsnummer}}).</p><p>Ihre Mitgliedschaft endet ordentlich zum: <strong>{{kuendigungsdatum}}</strong></p><p>Alle bis dahin anfallenden Beiträge sind satzungsgemäß zu entrichten. Wir bedauern, Sie als Mitglied zu verlieren.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 1),

-- 4. Ruhezeit-Bestätigung
(NULL, 1, 'ruhezeit', 'Ruhezeit Bestätigung',
 'Bestätigung Ihrer Ruhezeitanfrage — {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen Ihre Ruhezeitanfrage für den Zeitraum <strong>{{ruhezeitbeginn}}</strong> bis <strong>{{ruhezeitende}}</strong>.</p><p>In diesem Zeitraum wird Ihr Mitgliedsbeitrag ruhend gestellt.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Bestätigung Ihrer Ruhezeit',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen Ihre Ruhezeitanfrage (Mitgl.-Nr. {{mitgliedsnummer}}) für den Zeitraum:</p><p><strong>Von: {{ruhezeitbeginn}}<br>Bis: {{ruhezeitende}}</strong></p><p>In diesem Zeitraum wird Ihr Mitgliedsbeitrag entsprechend unserer Satzung ruhend gestellt. Die Mitgliedschaft bleibt bestehen.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 1),

-- 5. Zahlungserinnerung (freundlich)
(NULL, 1, 'zahlungserinnerung', 'Zahlungserinnerung (freundlich)',
 'Freundliche Zahlungserinnerung — {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir erlauben uns, Sie freundlich daran zu erinnern, dass noch ein offener Betrag von <strong>{{betrag}}</strong> (fällig am {{faelligkeitsdatum}}) auf Ihrem Konto besteht.</p><p>Sollte die Zahlung bereits erfolgt sein, betrachten Sie dieses Schreiben bitte als gegenstandslos.</p><p>IBAN: {{bank_iban}}<br>Verwendungszweck: {{mitgliedsnummer}}</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Freundliche Zahlungserinnerung',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir erlauben uns, Sie freundlich daran zu erinnern, dass noch folgender Betrag aussteht:</p><p><strong>Betrag: {{betrag}}<br>Fällig am: {{faelligkeitsdatum}}</strong></p><p>Bitte überweisen Sie den Betrag auf unser Konto:<br>IBAN: {{bank_iban}}<br>Verwendungszweck: Mitgl.-Nr. {{mitgliedsnummer}}</p><p>Sollte die Zahlung bereits erfolgt sein, betrachten Sie dieses Schreiben bitte als gegenstandslos.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0),

-- 6. Rücklastschrift-Info
(NULL, 1, 'ruecklastschrift_info', 'Rücklastschrift-Information',
 'Information zu einer Rücklastschrift — {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>leider konnte der Lastschrifteinzug über <strong>{{betrag}}</strong> nicht durchgeführt werden (Ihre Bank hat die Zahlung zurückgegeben).</p><p>Bitte überweisen Sie den Betrag umgehend oder kontaktieren Sie uns, um eine neue Bankverbindung zu hinterlegen.</p><p>IBAN: {{bank_iban}}<br>Verwendungszweck: {{mitgliedsnummer}}</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Rücklastschrift – Bitte um Klärung',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>leider mussten wir feststellen, dass der SEPA-Lastschrifteinzug für folgenden Betrag zurückgebucht wurde:</p><p><strong>Betrag: {{betrag}}</strong></p><p>Bitte überweisen Sie den ausstehenden Betrag auf unser Konto oder nehmen Sie umgehend Kontakt mit uns auf, um Ihre Zahlungsdaten zu aktualisieren.</p><p>IBAN: {{bank_iban}} · BIC: {{bank_bic}}<br>Kontoinhaber: {{bank_inhaber}}<br>Verwendungszweck: Mitgl.-Nr. {{mitgliedsnummer}}</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 1),

-- 7. Allgemeiner Infobrief
(NULL, 1, 'info_brief', 'Allgemeiner Infobrief',
 'Information von {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>[Ihr Text hier]</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 'Information',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>[Ihr Text hier]</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0),

-- 8. Prüfungs-Einladung
(NULL, 1, 'pruefung_einladung', 'Prüfungs-Einladung',
 'Einladung zur Graduierungsprüfung — {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir laden Sie herzlich zu unserer Graduierungsprüfung ein.<br>Termin: <strong>{{kurs_name}}</strong></p><p>Wir freuen uns auf Ihre Teilnahme und wünschen Ihnen schon jetzt viel Erfolg!</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Einladung zur Graduierungsprüfung',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir freuen uns, Sie zu unserer Graduierungsprüfung einladen zu dürfen.</p><p><strong>Prüfung: {{kurs_name}}</strong></p><p>Bitte erscheinen Sie rechtzeitig und vollständig ausgerüstet. Bei Fragen wenden Sie sich gerne an uns.</p><p>Wir wünschen Ihnen schon jetzt viel Erfolg!</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0);
