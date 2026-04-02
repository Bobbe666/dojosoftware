-- Migration: Create sessions table for express-session with MySQL store
-- Date: 2026-02-14
-- Purpose: Secure session storage for cookie-based authentication

-- Sessions table (required by express-mysql-session)
CREATE TABLE IF NOT EXISTS `sessions` (
    `session_id` VARCHAR(128) NOT NULL PRIMARY KEY,
    `expires` INT(11) UNSIGNED NOT NULL,
    `data` MEDIUMTEXT,
    `user_id` INT(11) DEFAULT NULL,
    `dojo_id` INT(11) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_expires` (`expires`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_dojo_id` (`dojo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password hash algorithm tracking (for migration to Argon2)
ALTER TABLE `admin_users`
ADD COLUMN IF NOT EXISTS `password_algorithm` ENUM('bcrypt', 'argon2id') DEFAULT 'bcrypt' AFTER `password`,
ADD COLUMN IF NOT EXISTS `password_changed_at` TIMESTAMP NULL DEFAULT NULL AFTER `password_algorithm`,
ADD COLUMN IF NOT EXISTS `failed_login_attempts` INT(11) DEFAULT 0 AFTER `password_changed_at`,
ADD COLUMN IF NOT EXISTS `locked_until` TIMESTAMP NULL DEFAULT NULL AFTER `failed_login_attempts`,
ADD COLUMN IF NOT EXISTS `last_login_ip` VARCHAR(45) DEFAULT NULL AFTER `locked_until`;

-- CSRF tokens table (for stateful CSRF protection)
CREATE TABLE IF NOT EXISTS `csrf_tokens` (
    `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `session_id` VARCHAR(128) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_expires` (`expires_at`),
    FOREIGN KEY (`session_id`) REFERENCES `sessions`(`session_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Security audit log for auth events
CREATE TABLE IF NOT EXISTS `auth_audit_log` (
    `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `event_type` ENUM('login_success', 'login_failed', 'logout', 'password_change', 'session_expired', 'account_locked', 'account_unlocked', 'csrf_violation') NOT NULL,
    `user_id` INT(11) DEFAULT NULL,
    `dojo_id` INT(11) DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` TEXT,
    `details` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_dojo_id` (`dojo_id`),
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_ip_address` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cleanup job: Delete expired sessions (run via cron)
-- DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP();
