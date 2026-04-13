-- ============================================================================
-- Migration 115: Erweiterte System-Vorlagen
-- Neue Kategorien + fehlende Templates für Mahnung, Gürtelvergabe,
-- Prüfungsergebnis, Kursanmeldung, Lizenz, Verband, Vertragsverlängerung
-- ============================================================================

-- ── ENUM erweitern: vertrag_verlaengerung + vertrag_bestaetigung ─────────────
ALTER TABLE dokument_vorlagen
  MODIFY COLUMN kategorie ENUM(
    'begruessung',
    'geburtstag',
    'kuendigung_bestaetigung',
    'ruhezeit',
    'vertrag_verlaengerung',
    'vertrag_bestaetigung',
    'rechnung',
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
  ) NOT NULL DEFAULT 'sonstiges';

-- ── Neue System-Vorlagen (nur fehlende Kategorien) ───────────────────────────

INSERT INTO dokument_vorlagen (dojo_id, system_vorlage, kategorie, name, email_betreff, email_html, brief_titel, brief_html, mit_pdf_anhang) VALUES

-- Vertragsverlängerung Angebot
(NULL, 1, 'vertrag_verlaengerung', 'Vertragsverlängerung Angebot',
 'Ihre Mitgliedschaft läuft bald aus – {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>Ihre aktuelle Mitgliedschaft (Nr. {{mitgliedsnummer}}) läuft am <strong>{{vertragsende}}</strong> aus.</p><p>Wir würden uns sehr freuen, Sie weiterhin in unserer Gemeinschaft begrüßen zu dürfen.</p><p>Bitte melden Sie sich bei uns, um Ihren Vertrag zu verlängern.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Angebot zur Vertragsverlängerung',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>Ihre Mitgliedschaft bei {{absender_name}} (Mitgl.-Nr.: {{mitgliedsnummer}}) endet am:</p><p><strong>{{vertragsende}}</strong></p><p>Wir möchten Ihnen die Möglichkeit geben, Ihre Mitgliedschaft zu denselben Konditionen zu verlängern und würden uns sehr freuen, Sie weiterhin bei uns zu haben.</p><p>Bitte nehmen Sie bis zum {{antwortfrist}} Kontakt mit uns auf oder kommen Sie direkt in unser Büro, um alle weiteren Details zu besprechen.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0),

-- 15. Vertragsverlängerung Bestätigung
(NULL, 1, 'vertrag_bestaetigung', 'Vertragsverlängerung Bestätigung',
 'Bestätigung Ihrer Vertragsverlängerung – {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen die Verlängerung Ihrer Mitgliedschaft bis zum <strong>{{vertragsende}}</strong>.</p><p>Wir freuen uns, Sie weiterhin bei uns zu haben!</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Bestätigung Ihrer Vertragsverlängerung',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen die Verlängerung Ihrer Mitgliedschaft (Nr. {{mitgliedsnummer}}) mit folgenden Konditionen:</p><p><strong>Neues Vertragsende: {{vertragsende}}<br>Monatsbeitrag: {{monatsbeitrag}}<br>Zahlungsweise: {{zahlungsweise}}</strong></p><p>Wir freuen uns auf die weitere gemeinsame Zeit!</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 1),

-- 16. Lizenz-Ausstellung
(NULL, 1, 'lizenz_ausstellung', 'Lizenz-Ausstellung',
 'Ihre Lizenz wurde ausgestellt – {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir freuen uns, Ihnen mitteilen zu können, dass Ihre Lizenz ausgestellt wurde.</p><p>Lizenz-Nr.: <strong>{{lizenz_nr}}</strong><br>Gültig bis: <strong>{{lizenz_ablauf}}</strong></p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Ausstellung Ihrer Lizenz',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir bestätigen die Ausstellung Ihrer Lizenz:</p><p><strong>Lizenz-Typ: {{lizenz_typ}}<br>Lizenz-Nr.: {{lizenz_nr}}<br>Ausgestellt am: {{system.datum}}<br>Gültig bis: {{lizenz_ablauf}}</strong></p><p>Bitte bewahren Sie dieses Dokument sorgfältig auf. Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 1),

-- 17. Lizenz-Verlängerung
(NULL, 1, 'lizenz_verlaengerung', 'Lizenz-Verlängerung Erinnerung',
 'Ihre Lizenz läuft bald ab – {{absender_name}}',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>Ihre Lizenz (Nr. {{lizenz_nr}}) läuft am <strong>{{lizenz_ablauf}}</strong> ab.</p><p>Bitte beantragen Sie rechtzeitig die Verlängerung, um eine Unterbrechung zu vermeiden.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>',
 'Erinnerung: Lizenzverlängerung erforderlich',
 '<p>Liebe/r {{anrede}} {{nachname}},</p><p>wir möchten Sie darauf aufmerksam machen, dass Ihre Lizenz demnächst abläuft:</p><p><strong>Lizenz-Typ: {{lizenz_typ}}<br>Lizenz-Nr.: {{lizenz_nr}}<br>Ablaufdatum: {{lizenz_ablauf}}</strong></p><p>Um eine Unterbrechung Ihrer Lizenz zu vermeiden, bitten wir Sie, den Verlängerungsantrag rechtzeitig zu stellen. Wenden Sie sich hierzu bitte an uns.</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0),

-- Verband-Info
(NULL, 1, 'verband_info', 'Verbandsinfo / Mitteilung',
 'Wichtige Information von {{absender_name}}',
 '<p>Liebe Mitglieder,</p><p>[Ihr Text hier]</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 'Informationsschreiben',
 '<p>Liebe Mitglieder,</p><p>[Ihr Text hier]</p><p>Mit freundlichen Grüßen<br>{{absender_inhaber}}<br>{{absender_name}}</p>',
 0);
