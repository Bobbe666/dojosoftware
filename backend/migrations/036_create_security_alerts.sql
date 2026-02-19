-- ===================================================================
-- SECURITY ALERTS SYSTEM
-- Tabelle für Sicherheitswarnungen und Angriffserkennung
-- ===================================================================

CREATE TABLE IF NOT EXISTS security_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_type ENUM(
        'brute_force',           -- Mehrere fehlgeschlagene Login-Versuche
        'sql_injection',         -- SQL-Injection Versuch erkannt
        'xss_attempt',           -- XSS Angriff erkannt
        'rate_limit_exceeded',   -- Rate-Limit überschritten
        'invalid_token',         -- Ungültiger/Manipulierter Token
        'suspicious_request',    -- Verdächtige Anfrage
        'unauthorized_access',   -- Unbefugter Zugriff
        'file_upload_attack',    -- Verdächtiger Datei-Upload
        'path_traversal',        -- Path Traversal Versuch
        'csrf_violation',        -- CSRF Token fehlt/ungültig
        'other'                  -- Sonstige Sicherheitsereignisse
    ) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_path VARCHAR(500),
    request_method VARCHAR(10),
    request_body TEXT,
    user_id INT,
    dojo_id INT,
    description TEXT,
    blocked BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by INT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_ip_address (ip_address),
    INDEX idx_created_at (created_at),
    INDEX idx_resolved (resolved),
    INDEX idx_dojo_id (dojo_id),
    INDEX idx_composite (alert_type, severity, created_at)
);

-- Tabelle für blockierte IPs
CREATE TABLE IF NOT EXISTS blocked_ips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason TEXT,
    blocked_until TIMESTAMP NULL,
    permanent BOOLEAN DEFAULT FALSE,
    alert_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_ip (ip_address),
    INDEX idx_blocked_until (blocked_until)
);

-- Tabelle für Security-Statistiken (aggregiert pro Tag)
CREATE TABLE IF NOT EXISTS security_stats_daily (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    total_alerts INT DEFAULT 0,
    brute_force_count INT DEFAULT 0,
    sql_injection_count INT DEFAULT 0,
    xss_count INT DEFAULT 0,
    rate_limit_count INT DEFAULT 0,
    blocked_requests INT DEFAULT 0,
    unique_ips INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_date (date)
);

-- ===================================================================
-- EVENT: Tägliche Statistik-Aggregation
-- ===================================================================

DELIMITER //

CREATE EVENT IF NOT EXISTS aggregate_security_stats_daily
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 1 HOUR)
DO
BEGIN
    INSERT INTO security_stats_daily (
        date,
        total_alerts,
        brute_force_count,
        sql_injection_count,
        xss_count,
        rate_limit_count,
        blocked_requests,
        unique_ips
    )
    SELECT
        DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)) as date,
        COUNT(*) as total_alerts,
        SUM(CASE WHEN alert_type = 'brute_force' THEN 1 ELSE 0 END) as brute_force_count,
        SUM(CASE WHEN alert_type = 'sql_injection' THEN 1 ELSE 0 END) as sql_injection_count,
        SUM(CASE WHEN alert_type = 'xss_attempt' THEN 1 ELSE 0 END) as xss_count,
        SUM(CASE WHEN alert_type = 'rate_limit_exceeded' THEN 1 ELSE 0 END) as rate_limit_count,
        SUM(CASE WHEN blocked = TRUE THEN 1 ELSE 0 END) as blocked_requests,
        COUNT(DISTINCT ip_address) as unique_ips
    FROM security_alerts
    WHERE DATE(created_at) = DATE(DATE_SUB(NOW(), INTERVAL 1 DAY))
    ON DUPLICATE KEY UPDATE
        total_alerts = VALUES(total_alerts),
        brute_force_count = VALUES(brute_force_count),
        sql_injection_count = VALUES(sql_injection_count),
        xss_count = VALUES(xss_count),
        rate_limit_count = VALUES(rate_limit_count),
        blocked_requests = VALUES(blocked_requests),
        unique_ips = VALUES(unique_ips);
END//

DELIMITER ;

-- ===================================================================
-- EVENT: Alte Alerts aufräumen (nach 90 Tagen)
-- ===================================================================

DELIMITER //

CREATE EVENT IF NOT EXISTS cleanup_old_security_alerts
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Gelöste Alerts nach 90 Tagen löschen
    DELETE FROM security_alerts
    WHERE resolved = TRUE
    AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

    -- Temporär blockierte IPs entsperren
    DELETE FROM blocked_ips
    WHERE permanent = FALSE
    AND blocked_until IS NOT NULL
    AND blocked_until < NOW();
END//

DELIMITER ;
