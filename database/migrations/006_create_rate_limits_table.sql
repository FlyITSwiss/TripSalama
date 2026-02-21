-- TripSalama - Migration 006
-- Table rate_limits (protection anti-bruteforce)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `rate_limits`;

CREATE TABLE `rate_limits` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `key_identifier` VARCHAR(255) NOT NULL COMMENT 'Hash de IP + identifiant',
    `action` VARCHAR(50) NOT NULL DEFAULT 'login' COMMENT 'Type action (login, register, password_reset)',
    `ip_address` VARCHAR(45) NOT NULL COMMENT 'Adresse IP (IPv4 ou IPv6)',
    `attempts` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Nombre de tentatives',
    `first_attempt_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_attempt_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_rate_limits_key_action` (`key_identifier`, `action`),
    INDEX `idx_rate_limits_last_attempt` (`last_attempt_at`),
    INDEX `idx_rate_limits_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
