-- Migration 061: SaaS Notification Log Table
-- Tracking aller gesendeten SaaS-Benachrichtigungen

CREATE TABLE IF NOT EXISTS saas_notification_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dojo_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    email_to VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NULL,
    status ENUM('sent', 'failed', 'pending') DEFAULT 'sent',
    error_message TEXT NULL,
    metadata JSON NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_dojo_id (dojo_id),
    INDEX idx_notification_type (notification_type),
    INDEX idx_sent_at (sent_at),
    INDEX idx_status (status),
    INDEX idx_dojo_type_date (dojo_id, notification_type, sent_at),

    FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE
);

-- Tabelle für Cron-Job Status Tracking
CREATE TABLE IF NOT EXISTS saas_cron_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL UNIQUE,
    last_run TIMESTAMP NULL,
    next_run TIMESTAMP NULL,
    status ENUM('idle', 'running', 'failed') DEFAULT 'idle',
    last_error TEXT NULL,
    run_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initial Cron Jobs eintragen
INSERT INTO saas_cron_jobs (job_name, status) VALUES
    ('check_expiring_trials', 'idle'),
    ('check_expired_trials', 'idle'),
    ('check_failed_payments', 'idle')
ON DUPLICATE KEY UPDATE job_name = job_name;
