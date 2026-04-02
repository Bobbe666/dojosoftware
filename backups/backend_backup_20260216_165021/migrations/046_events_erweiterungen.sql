-- ============================================================================
-- Migration 046: Events System Erweiterungen
-- Warteliste, Email-Templates, verbesserte Tracking-Felder
-- ============================================================================

-- 1. Warteliste-Status und Position hinzufügen
ALTER TABLE event_anmeldungen
MODIFY status ENUM('angemeldet', 'bestaetigt', 'warteliste', 'abgesagt', 'teilgenommen', 'nicht_erschienen') DEFAULT 'angemeldet';

ALTER TABLE event_anmeldungen
ADD COLUMN IF NOT EXISTS warteliste_position INT DEFAULT NULL AFTER status;

ALTER TABLE event_anmeldungen
ADD COLUMN IF NOT EXISTS email_bestaetigung_gesendet TINYINT(1) DEFAULT 0 AFTER warteliste_position;

ALTER TABLE event_anmeldungen
ADD COLUMN IF NOT EXISTS erinnerung_gesendet TINYINT(1) DEFAULT 0 AFTER email_bestaetigung_gesendet;

-- Index für Warteliste-Abfragen
ALTER TABLE event_anmeldungen
ADD INDEX IF NOT EXISTS idx_warteliste (event_id, status, warteliste_position);

-- 2. Event-Tabelle erweitern
ALTER TABLE events
ADD COLUMN IF NOT EXISTS erinnerung_tage INT DEFAULT 3 COMMENT 'Tage vor Event für Erinnerung';

ALTER TABLE events
ADD COLUMN IF NOT EXISTS erinnerung_gesendet TINYINT(1) DEFAULT 0;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS absage_grund TEXT AFTER status;

-- 3. Email-Templates für Events
CREATE TABLE IF NOT EXISTS event_email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables JSON COMMENT 'Liste der verfügbaren Variablen',
    aktiv TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Email-Templates einfügen
INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_anmeldung', 'Event Anmeldung', 'Anmeldung bestätigt: {{eventTitel}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #FFD700;">Anmeldung erfolgreich!</h2>
<p>Hallo {{vorname}},</p>
<p>Deine Anmeldung für das Event <strong>{{eventTitel}}</strong> wurde erfolgreich registriert.</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
<p><strong>📅 Datum:</strong> {{datum}}</p>
<p><strong>🕐 Uhrzeit:</strong> {{uhrzeit}}</p>
<p><strong>📍 Ort:</strong> {{ort}}</p>
{{#if gebuehr}}<p><strong>💰 Teilnahmegebühr:</strong> {{gebuehr}} €</p>{{/if}}
</div>
{{#if zahlungslink}}<p><a href="{{zahlungslink}}" style="display: inline-block; background: #FFD700; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Jetzt bezahlen</a></p>{{/if}}
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\nDeine Anmeldung für {{eventTitel}} wurde registriert.\n\nDatum: {{datum}}\nUhrzeit: {{uhrzeit}}\nOrt: {{ort}}\n{{#if gebuehr}}Teilnahmegebühr: {{gebuehr}} €{{/if}}\n\nMit sportlichen Grüßen,\n{{dojoname}}',
'["vorname", "eventTitel", "datum", "uhrzeit", "ort", "gebuehr", "zahlungslink", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_bestaetigung', 'Zahlung bestätigt', 'Zahlung bestätigt: {{eventTitel}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #22c55e;">✅ Zahlung eingegangen!</h2>
<p>Hallo {{vorname}},</p>
<p>Deine Zahlung für <strong>{{eventTitel}}</strong> ist eingegangen. Deine Teilnahme ist damit bestätigt!</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
<p><strong>📅 Datum:</strong> {{datum}}</p>
<p><strong>🕐 Uhrzeit:</strong> {{uhrzeit}}</p>
<p><strong>📍 Ort:</strong> {{ort}}</p>
<p><strong>💰 Bezahlter Betrag:</strong> {{betrag}} €</p>
</div>
<p>Wir freuen uns auf dich!</p>
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\nDeine Zahlung für {{eventTitel}} ist eingegangen.\n\nDatum: {{datum}}\nUhrzeit: {{uhrzeit}}\nOrt: {{ort}}\nBezahlt: {{betrag}} €\n\nWir freuen uns auf dich!\n\n{{dojoname}}',
'["vorname", "eventTitel", "datum", "uhrzeit", "ort", "betrag", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_aenderung', 'Event geändert', 'Wichtig: Änderung bei {{eventTitel}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #f59e0b;">⚠️ Event-Änderung</h2>
<p>Hallo {{vorname}},</p>
<p>Das Event <strong>{{eventTitel}}</strong>, für das du angemeldet bist, wurde geändert.</p>
<div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
<p><strong>Änderungen:</strong></p>
{{aenderungen}}
</div>
<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
<p><strong>Aktuelle Details:</strong></p>
<p><strong>📅 Datum:</strong> {{datum}}</p>
<p><strong>🕐 Uhrzeit:</strong> {{uhrzeit}}</p>
<p><strong>📍 Ort:</strong> {{ort}}</p>
</div>
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\nDas Event {{eventTitel}} wurde geändert.\n\nÄnderungen:\n{{aenderungen}}\n\nAktuelle Details:\nDatum: {{datum}}\nUhrzeit: {{uhrzeit}}\nOrt: {{ort}}\n\n{{dojoname}}',
'["vorname", "eventTitel", "datum", "uhrzeit", "ort", "aenderungen", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_absage', 'Event abgesagt', 'Absage: {{eventTitel}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #ef4444;">❌ Event abgesagt</h2>
<p>Hallo {{vorname}},</p>
<p>Leider müssen wir dir mitteilen, dass das Event <strong>{{eventTitel}}</strong> abgesagt wurde.</p>
{{#if grund}}<div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
<p><strong>Grund:</strong> {{grund}}</p>
</div>{{/if}}
<p>Wir bedauern die Unannehmlichkeiten und hoffen, dich bald bei einem anderen Event begrüßen zu dürfen.</p>
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\nLeider wurde {{eventTitel}} abgesagt.\n\n{{#if grund}}Grund: {{grund}}{{/if}}\n\nWir bedauern die Unannehmlichkeiten.\n\n{{dojoname}}',
'["vorname", "eventTitel", "grund", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_erinnerung', 'Event Erinnerung', 'Erinnerung: {{eventTitel}} in {{tage}} Tagen',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #6366f1;">📢 Event-Erinnerung</h2>
<p>Hallo {{vorname}},</p>
<p>Zur Erinnerung: In <strong>{{tage}} Tagen</strong> findet das Event <strong>{{eventTitel}}</strong> statt!</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
<p><strong>📅 Datum:</strong> {{datum}}</p>
<p><strong>🕐 Uhrzeit:</strong> {{uhrzeit}}</p>
<p><strong>📍 Ort:</strong> {{ort}}</p>
{{#if anforderungen}}<p><strong>📋 Bitte mitbringen:</strong> {{anforderungen}}</p>{{/if}}
</div>
<p>Wir freuen uns auf dich!</p>
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\nErinnerung: In {{tage}} Tagen findet {{eventTitel}} statt!\n\nDatum: {{datum}}\nUhrzeit: {{uhrzeit}}\nOrt: {{ort}}\n{{#if anforderungen}}Bitte mitbringen: {{anforderungen}}{{/if}}\n\nWir freuen uns auf dich!\n\n{{dojoname}}',
'["vorname", "eventTitel", "datum", "uhrzeit", "ort", "tage", "anforderungen", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_warteliste', 'Warteliste', 'Warteliste: {{eventTitel}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #8b5cf6;">📝 Auf der Warteliste</h2>
<p>Hallo {{vorname}},</p>
<p>Das Event <strong>{{eventTitel}}</strong> ist leider bereits ausgebucht. Du wurdest auf die Warteliste gesetzt.</p>
<div style="background: #ede9fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
<p><strong>Deine Position:</strong> #{{position}}</p>
</div>
<p>Sobald ein Platz frei wird, benachrichtigen wir dich automatisch per E-Mail.</p>
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\n{{eventTitel}} ist ausgebucht. Du stehst auf der Warteliste.\n\nDeine Position: #{{position}}\n\nWir benachrichtigen dich, wenn ein Platz frei wird.\n\n{{dojoname}}',
'["vorname", "eventTitel", "position", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO event_email_templates (template_key, name, subject, html_content, text_content, variables) VALUES
('event_von_warteliste', 'Platz frei geworden', 'Platz frei: {{eventTitel}} - Jetzt anmelden!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #22c55e;">🎉 Platz frei geworden!</h2>
<p>Hallo {{vorname}},</p>
<p>Gute Neuigkeiten! Für das Event <strong>{{eventTitel}}</strong> ist ein Platz frei geworden und du bist von der Warteliste nachgerückt!</p>
<div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
<p><strong>📅 Datum:</strong> {{datum}}</p>
<p><strong>🕐 Uhrzeit:</strong> {{uhrzeit}}</p>
<p><strong>📍 Ort:</strong> {{ort}}</p>
</div>
{{#if zahlungslink}}<p><strong>Wichtig:</strong> Bitte bezahle die Teilnahmegebühr innerhalb von 48 Stunden, um deinen Platz zu sichern.</p>
<p><a href="{{zahlungslink}}" style="display: inline-block; background: #22c55e; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Jetzt bezahlen</a></p>{{/if}}
<p>Mit sportlichen Grüßen,<br>{{dojoname}}</p>
</div>',
'Hallo {{vorname}},\n\nEin Platz für {{eventTitel}} ist frei geworden!\n\nDatum: {{datum}}\nUhrzeit: {{uhrzeit}}\nOrt: {{ort}}\n\n{{#if zahlungslink}}Bitte bezahle innerhalb von 48 Stunden: {{zahlungslink}}{{/if}}\n\n{{dojoname}}',
'["vorname", "eventTitel", "datum", "uhrzeit", "ort", "zahlungslink", "dojoname"]')
ON DUPLICATE KEY UPDATE name = name;

-- 4. Event-Zahlungen Tracking
CREATE TABLE IF NOT EXISTS event_zahlungen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anmeldung_id INT NOT NULL,
    event_id INT NOT NULL,
    mitglied_id INT NOT NULL,
    betrag DECIMAL(10,2) NOT NULL,
    zahlungsmethode ENUM('stripe', 'paypal', 'bar', 'ueberweisung', 'sonstig') DEFAULT 'stripe',
    stripe_payment_intent_id VARCHAR(100),
    paypal_order_id VARCHAR(100),
    status ENUM('ausstehend', 'bezahlt', 'fehlgeschlagen', 'erstattet') DEFAULT 'ausstehend',
    bezahlt_am DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_anmeldung (anmeldung_id),
    INDEX idx_event (event_id),
    INDEX idx_mitglied (mitglied_id),
    INDEX idx_status (status),

    FOREIGN KEY (anmeldung_id) REFERENCES event_anmeldungen(anmeldung_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Hinweis: Nach dem Ausführen dieser Migration sind folgende Features aktiv:
-- 1. Warteliste für ausgebuchte Events
-- 2. Email-Benachrichtigungen mit Templates
-- 3. Zahlungs-Tracking für Event-Gebühren
-- ============================================================================
