-- TripSalama - Migration 002
-- Table vehicles (vehicules des conductrices)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `vehicles`;

CREATE TABLE `vehicles` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `driver_id` INT UNSIGNED NOT NULL,
    `brand` VARCHAR(100) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `color` VARCHAR(50) NOT NULL,
    `license_plate` VARCHAR(20) NOT NULL,
    `year` SMALLINT UNSIGNED NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_vehicles_driver` (`driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table driver_status (statut temps reel conductrice)
DROP TABLE IF EXISTS `driver_status`;

CREATE TABLE `driver_status` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `driver_id` INT UNSIGNED NOT NULL,
    `is_available` TINYINT(1) NOT NULL DEFAULT 0,
    `current_lat` DECIMAL(10, 8) NULL,
    `current_lng` DECIMAL(11, 8) NULL,
    `last_update` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_driver_status_driver` (`driver_id`),
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_driver_status_available` (`is_available`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
