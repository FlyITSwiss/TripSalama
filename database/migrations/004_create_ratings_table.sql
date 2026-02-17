-- TripSalama - Migration 004
-- Table ratings (notations)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `ratings`;

CREATE TABLE `ratings` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `ride_id` INT UNSIGNED NOT NULL,

    -- Notation par la passagere (pour la conductrice)
    `passenger_rating` TINYINT UNSIGNED NULL CHECK (`passenger_rating` BETWEEN 1 AND 5),
    `passenger_comment` TEXT NULL,
    `passenger_rated_at` TIMESTAMP NULL,

    -- Notation par la conductrice (pour la passagere)
    `driver_rating` TINYINT UNSIGNED NULL CHECK (`driver_rating` BETWEEN 1 AND 5),
    `driver_comment` TEXT NULL,
    `driver_rated_at` TIMESTAMP NULL,

    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_ratings_ride` (`ride_id`),
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
