-- TripSalama - Migration 008
-- Table des positions des conductrices en temps réel

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- Table driver_locations (Positions conductrices)
-- ============================================
CREATE TABLE IF NOT EXISTS `driver_locations` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `driver_id` INT UNSIGNED NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `heading` DECIMAL(5, 2) NULL COMMENT 'Direction en degrés (0-360)',
    `speed` DECIMAL(6, 2) NULL COMMENT 'Vitesse en km/h',
    `accuracy` DECIMAL(8, 2) NULL COMMENT 'Précision GPS en mètres',
    `altitude` DECIMAL(8, 2) NULL COMMENT 'Altitude en mètres',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_driver_locations_driver` (`driver_id`),
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_driver_locations_coords` (`latitude`, `longitude`),
    INDEX `idx_driver_locations_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table driver_location_history (Historique optionnel)
-- ============================================
CREATE TABLE IF NOT EXISTS `driver_location_history` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `driver_id` INT UNSIGNED NOT NULL,
    `ride_id` INT UNSIGNED NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `heading` DECIMAL(5, 2) NULL,
    `speed` DECIMAL(6, 2) NULL,
    `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE,
    INDEX `idx_location_history_driver` (`driver_id`, `recorded_at`),
    INDEX `idx_location_history_ride` (`ride_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Ajouter colonnes is_online et is_verified à users si pas présentes
-- ============================================
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `is_online` TINYINT(1) NOT NULL DEFAULT 0 AFTER `role`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `is_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_online`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `last_online_at` TIMESTAMP NULL AFTER `is_verified`;

-- Index pour recherche conductrices en ligne
ALTER TABLE `users` ADD INDEX IF NOT EXISTS `idx_users_online_role` (`role`, `is_online`, `is_verified`);

SET FOREIGN_KEY_CHECKS = 1;
