-- TripSalama - Migration 014
-- Create remember_tokens table for "Remember Me" feature
-- Token duration: 30 days (standard)

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `remember_tokens` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `user_agent` VARCHAR(500) NULL,
    `ip_address` VARCHAR(45) NULL,

    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_token_hash` (`token_hash`),
    INDEX `idx_expires_at` (`expires_at`),

    CONSTRAINT `fk_remember_tokens_user`
        FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up expired tokens (can be run periodically)
-- DELETE FROM remember_tokens WHERE expires_at < NOW();
