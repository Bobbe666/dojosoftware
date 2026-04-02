-- Migration 062: Globale SaaS-Einstellungen
-- Zentrale Konfiguration für das Lizenz-/Subscription-System

CREATE TABLE IF NOT EXISTS saas_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category ENUM('stripe', 'trial', 'email', 'branding', 'limits', 'pricing', 'general') DEFAULT 'general',
    description VARCHAR(500),
    is_secret BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_category (category),
    INDEX idx_key (setting_key)
);

-- =============================================
-- STRIPE EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('stripe_secret_key', NULL, 'string', 'stripe', 'Stripe Secret Key (sk_live_... oder sk_test_...)', TRUE),
('stripe_publishable_key', NULL, 'string', 'stripe', 'Stripe Publishable Key (pk_live_... oder pk_test_...)', FALSE),
('stripe_webhook_secret', NULL, 'string', 'stripe', 'Stripe Webhook Signing Secret (whsec_...)', TRUE),
('stripe_test_mode', 'true', 'boolean', 'stripe', 'Test-Modus aktiviert (true/false)', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =============================================
-- TRIAL EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('trial_duration_days', '14', 'number', 'trial', 'Standard Trial-Dauer in Tagen', FALSE),
('trial_max_members', '50', 'number', 'trial', 'Maximale Mitglieder während Trial', FALSE),
('trial_storage_mb', '500', 'number', 'trial', 'Speicherplatz während Trial (MB)', FALSE),
('trial_features', '{"verkauf":false,"buchfuehrung":false,"events":true,"api":false}', 'json', 'trial', 'Features während Trial (JSON)', FALSE),
('trial_reminder_days', '[7,3,1]', 'json', 'trial', 'Tage vor Ablauf für Erinnerungen', FALSE),
('trial_auto_extend', 'false', 'boolean', 'trial', 'Trial automatisch verlängern bei Inaktivität', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =============================================
-- EMAIL EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('admin_notification_email', 'admin@tda-intl.org', 'string', 'email', 'Email für Admin-Benachrichtigungen', FALSE),
('support_email', 'support@tda-intl.org', 'string', 'email', 'Support-Email für Kunden', FALSE),
('billing_email', 'billing@tda-intl.org', 'string', 'email', 'Email für Rechnungsfragen', FALSE),
('email_notifications_enabled', 'true', 'boolean', 'email', 'Email-Benachrichtigungen aktiviert', FALSE),
('send_trial_reminders', 'true', 'boolean', 'email', 'Trial-Ablauf Erinnerungen senden', FALSE),
('send_payment_confirmations', 'true', 'boolean', 'email', 'Zahlungsbestätigungen senden', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =============================================
-- BRANDING EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('company_name', 'Tiger & Dragon Association International', 'string', 'branding', 'Firmenname für Rechnungen', FALSE),
('company_address', 'TDA International e.V.', 'string', 'branding', 'Firmenadresse', FALSE),
('company_logo_url', '/images/tda-logo.png', 'string', 'branding', 'Logo-URL für Emails/Rechnungen', FALSE),
('primary_color', '#3b82f6', 'string', 'branding', 'Primärfarbe (Hex)', FALSE),
('invoice_footer', 'Vielen Dank für Ihr Vertrauen in DojoSoftware!', 'string', 'branding', 'Footer-Text für Rechnungen', FALSE),
('terms_url', 'https://dojo.tda-intl.org/agb', 'string', 'branding', 'URL zu den AGB', FALSE),
('privacy_url', 'https://dojo.tda-intl.org/datenschutz', 'string', 'branding', 'URL zur Datenschutzerklärung', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =============================================
-- LIMITS EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('max_dojos_total', '1000', 'number', 'limits', 'Maximale Anzahl Dojos gesamt', FALSE),
('max_registrations_per_day', '10', 'number', 'limits', 'Maximale Neuregistrierungen pro Tag', FALSE),
('default_storage_mb', '1000', 'number', 'limits', 'Standard-Speicherplatz für neue Dojos (MB)', FALSE),
('max_file_upload_mb', '10', 'number', 'limits', 'Maximale Dateigröße für Uploads (MB)', FALSE),
('session_timeout_hours', '24', 'number', 'limits', 'Session-Timeout in Stunden', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =============================================
-- PRICING EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('currency', 'EUR', 'string', 'pricing', 'Währung für Preise', FALSE),
('tax_rate', '19', 'number', 'pricing', 'Steuersatz in Prozent (MwSt)', FALSE),
('tax_included', 'true', 'boolean', 'pricing', 'Preise inkl. MwSt anzeigen', FALSE),
('annual_discount_percent', '17', 'number', 'pricing', 'Rabatt für Jahreszahlung (%)', FALSE),
('allow_promo_codes', 'true', 'boolean', 'pricing', 'Promo-Codes erlauben', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- =============================================
-- ALLGEMEINE EINSTELLUNGEN
-- =============================================
INSERT INTO saas_settings (setting_key, setting_value, setting_type, category, description, is_secret) VALUES
('maintenance_mode', 'false', 'boolean', 'general', 'Wartungsmodus aktiviert', FALSE),
('registration_enabled', 'true', 'boolean', 'general', 'Neue Registrierungen erlaubt', FALSE),
('default_language', 'de', 'string', 'general', 'Standard-Sprache', FALSE),
('timezone', 'Europe/Berlin', 'string', 'general', 'Standard-Zeitzone', FALSE),
('audit_log_retention_days', '365', 'number', 'general', 'Audit-Log Aufbewahrung in Tagen', FALSE)
ON DUPLICATE KEY UPDATE setting_key = setting_key;
