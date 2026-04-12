-- Migration 116: Trainer-Dokument-Vorlagen
-- Fügt trainer_vereinbarung und trainer_infoblatt als Kategorie hinzu
-- und legt diese als System-Vorlagen in dokument_vorlagen an.

-- ── 1. ENUM erweitern ──────────────────────────────────────────────────────────
ALTER TABLE dokument_vorlagen
  MODIFY COLUMN kategorie ENUM(
    'begruessung','geburtstag','kuendigung_bestaetigung','ruhezeit',
    'vertrag_verlaengerung','vertrag_bestaetigung','kursanmeldung',
    'zahlungserinnerung','mahnung','mahnbescheid','ruecklastschrift_info','rechnung',
    'pruefung_einladung','pruefung_ergebnis','guertelvergabe',
    'lizenz_ausstellung','lizenz_verlaengerung','verband_info',
    'info_brief','rundschreiben','sonstiges',
    'trainer_vereinbarung','trainer_infoblatt'
  ) NOT NULL DEFAULT 'sonstiges';

-- ── 2. System-Vorlage: Trainervereinbarung ─────────────────────────────────────
INSERT INTO dokument_vorlagen
  (dojo_id, system_vorlage, kategorie, name, brief_titel, brief_html, email_betreff, email_html, mit_pdf_anhang, aktiv)
VALUES (
  NULL,
  1,
  'trainer_vereinbarung',
  'Trainervereinbarung freie Mitarbeit',
  'Trainervereinbarung – Freie Mitarbeit (Sachleistungsvergütung)',
  '<p>Diese Vorlage wird als spezielles Trainer-Vertragsdokument (rotes KKS-Design) generiert.</p>
<p>Die Felder werden beim Erstellen aus dem Trainer-Profil befüllt. Bearbeitbar über den Trainer-Bereich → Dokumente.</p>
<p><strong>Enthält:</strong> §§ 1–14 inkl. Anhang A (Leistungsübersicht + Trainingszeiten)</p>',
  'Trainervereinbarung – Ihre Unterlagen zur Unterschrift',
  '<p>Anbei finden Sie Ihre Trainervereinbarung mit der {{absender_name}} zur Durchsicht und Unterzeichnung.</p>
<p>Bitte nehmen Sie sich die Zeit, das Dokument in Ruhe zu lesen. Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
<p>Mit freundlichen Grüßen<br/>{{absender_inhaber}}</p>',
  1,
  1
);

-- ── 3. System-Vorlage: Infoblatt ───────────────────────────────────────────────
INSERT INTO dokument_vorlagen
  (dojo_id, system_vorlage, kategorie, name, brief_titel, brief_html, email_betreff, email_html, mit_pdf_anhang, aktiv)
VALUES (
  NULL,
  1,
  'trainer_infoblatt',
  'Infoblatt Trainervereinbarung',
  'Dein Weg als Trainer – Was sich ändert und was nicht',
  '<p>Diese Vorlage wird als spezielles Trainer-Infodokument (rotes KKS-Design) generiert.</p>
<p>Enthält eine verständliche Erklärung der Trainervereinbarung mit FAQ-Bereich.</p>',
  'Infoblatt zu deiner Trainervereinbarung',
  '<p>Anbei findest du das Infoblatt zu deiner Trainervereinbarung mit der {{absender_name}}.</p>
<p>Es erklärt in einfachen Worten, was sich für dich ändert – und was nicht.</p>
<p>Bei Fragen melde dich einfach.<br/>{{absender_inhaber}}</p>',
  1,
  1
);
