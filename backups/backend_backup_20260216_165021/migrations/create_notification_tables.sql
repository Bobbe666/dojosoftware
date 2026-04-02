-- ===================================================================
-- 📧 BENACHRICHTIGUNGSSYSTEM DATENBANK-TABELLEN
-- ===================================================================

-- Notification Settings Tabelle
CREATE TABLE IF NOT EXISTS notification_settings (
    id INT PRIMARY KEY DEFAULT 1,
    email_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT FALSE,
    email_config JSON,
    push_config JSON,
    default_from_email VARCHAR(255),
    default_from_name VARCHAR(255) DEFAULT 'Dojo Software',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Notifications Verlauf Tabelle
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('email', 'push', 'sms') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    message TEXT,
    status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
    error_message TEXT,
    template_id INT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_recipient (recipient),
    INDEX idx_created_at (created_at)
);

-- Email Templates Tabelle
CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    variables JSON,
    category VARCHAR(100) DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_active (is_active)
);

-- Push Notification Subscriptions Tabelle
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    endpoint VARCHAR(500) NOT NULL,
    p256dh_key VARCHAR(255),
    auth_key VARCHAR(255),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_active (is_active),
    INDEX idx_endpoint (endpoint(100))
);

-- Newsletter Subscriptions Tabelle
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    status ENUM('active', 'unsubscribed', 'bounced') DEFAULT 'active',
    subscription_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribe_date TIMESTAMP NULL,
    unsubscribe_token VARCHAR(255),
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status)
);

-- Notification Queue Tabelle (für geplante Benachrichtigungen)
CREATE TABLE IF NOT EXISTS notification_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('email', 'push', 'sms') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    message TEXT,
    template_id INT,
    scheduled_at TIMESTAMP NOT NULL,
    status ENUM('pending', 'processing', 'sent', 'failed', 'cancelled') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_status (status),
    INDEX idx_type (type)
);

-- ===================================================================
-- 📧 STANDARD EMAIL TEMPLATES EINFÜGEN
-- ===================================================================

INSERT INTO email_templates (name, subject, content, variables, category) VALUES
('welcome', 'Willkommen im Dojo!', 
'<h2>Willkommen {{name}}!</h2>
<p>Herzlich willkommen in unserem Dojo! Wir freuen uns, Sie als neues Mitglied begrüßen zu dürfen.</p>
<p><strong>Ihre Mitgliedsdaten:</strong></p>
<ul>
    <li>Name: {{name}}</li>
    <li>Email: {{email}}</li>
    <li>Mitgliedschaft: {{membership_type}}</li>
    <li>Startdatum: {{start_date}}</li>
</ul>
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>', 
'["name", "email", "membership_type", "start_date"]', 'welcome'),

('payment_reminder', 'Beitragserinnerung - {{month}}',
'<h2>Beitragserinnerung</h2>
<p>Liebe/r {{name}},</p>
<p>dies ist eine freundliche Erinnerung, dass Ihr Mitgliedsbeitrag für {{month}} noch aussteht.</p>
<p><strong>Betrag:</strong> {{amount}} €<br>
<strong>Fälligkeitsdatum:</strong> {{due_date}}</p>
<p>Bitte überweisen Sie den Betrag zeitnah, um Ihre Mitgliedschaft aufrechtzuerhalten.</p>
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>',
'["name", "month", "amount", "due_date"]', 'payment'),

('course_cancellation', 'Kursabsage: {{course_name}}',
'<h2>Kursabsage</h2>
<p>Liebe/r {{name}},</p>
<p>leider müssen wir den Kurs "{{course_name}}" am {{date}} um {{time}} absagen.</p>
<p><strong>Grund:</strong> {{reason}}</p>
<p>Wir bemühen uns um einen Ersatztermin und informieren Sie sobald wie möglich.</p>
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>',
'["name", "course_name", "date", "time", "reason"]', 'course'),

('exam_notification', 'Prüfungstermin: {{belt_color}} Gürtel',
'<h2>Prüfungstermin</h2>
<p>Liebe/r {{name}},</p>
<p>wir freuen uns, Ihnen mitteilen zu können, dass Sie zur {{belt_color}} Gürtelprüfung eingeladen sind.</p>
<p><strong>Datum:</strong> {{exam_date}}<br>
<strong>Uhrzeit:</strong> {{exam_time}}<br>
<strong>Ort:</strong> {{location}}</p>
<p>Bitte erscheinen Sie pünktlich und in vollständiger Trainingsausrüstung.</p>
<p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>',
'["name", "belt_color", "exam_date", "exam_time", "location"]', 'exam'),

('newsletter_general', '{{newsletter_title}}',
'<h2>{{newsletter_title}}</h2>
<p>Liebe Dojo-Mitglieder,</p>
{{newsletter_content}}
<p>Vielen Dank für Ihr Interesse an unserem Dojo!</p>
<p>Mit freundlichen Grüßen<br>Ihr Dojo-Team</p>
<p><small>Sie erhalten diese Email, weil Sie unseren Newsletter abonniert haben. <a href="{{unsubscribe_link}}">Hier abmelden</a></small></p>',
'["newsletter_title", "newsletter_content", "unsubscribe_link"]', 'newsletter');

-- ===================================================================
-- 📧 STANDARD EINSTELLUNGEN EINFÜGEN
-- ===================================================================

INSERT INTO notification_settings (id, email_enabled, push_enabled, default_from_email, default_from_name) 
VALUES (1, FALSE, FALSE, '', 'Dojo Software')
ON DUPLICATE KEY UPDATE id = id;

-- ===================================================================
-- 📊 TRIGGER FÜR AUTOMATISCHE BENACHRICHTIGUNGEN
-- ===================================================================

DELIMITER //

-- Trigger für neue Mitglieder (Willkommens-Email)
CREATE TRIGGER IF NOT EXISTS new_member_welcome
AFTER INSERT ON mitglieder
FOR EACH ROW
BEGIN
    IF NEW.email IS NOT NULL AND NEW.email != '' THEN
        INSERT INTO notification_queue (type, recipient, subject, message, template_id, scheduled_at, status, metadata)
        SELECT 
            'email',
            NEW.email,
            'Willkommen im Dojo!',
            CONCAT('Willkommen ', NEW.vorname, ' ', NEW.nachname, '!'),
            1, -- welcome template
            NOW(),
            'pending',
            JSON_OBJECT('member_id', NEW.id, 'trigger', 'new_member')
        FROM email_templates 
        WHERE name = 'welcome' AND is_active = TRUE
        LIMIT 1;
    END IF;
END//

DELIMITER ;

-- ===================================================================
-- 📈 INDEXES FÜR PERFORMANCE
-- ===================================================================

-- Zusätzliche Indexes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_notifications_composite ON notifications(type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_composite ON notification_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active, category);

-- ===================================================================
-- 📋 CLEANUP JOB (für alte Benachrichtigungen)
-- ===================================================================

-- Event für automatische Bereinigung alter Benachrichtigungen (läuft täglich)
SET GLOBAL event_scheduler = ON;

DELIMITER //

CREATE EVENT IF NOT EXISTS cleanup_old_notifications
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Lösche Benachrichtigungen älter als 1 Jahr
    DELETE FROM notifications 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    
    -- Lösche verarbeitete Queue-Einträge älter als 30 Tage
    DELETE FROM notification_queue 
    WHERE processed_at IS NOT NULL 
    AND processed_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Lösche abgesagte Queue-Einträge älter als 7 Tage
    DELETE FROM notification_queue 
    WHERE status = 'cancelled' 
    AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
END//

DELIMITER ;

