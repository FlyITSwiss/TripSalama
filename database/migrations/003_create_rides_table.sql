-- TripSalama - Migration 003
-- Table rides (courses)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `rides`;

CREATE TABLE `rides` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `passenger_id` INT UNSIGNED NOT NULL,
    `driver_id` INT UNSIGNED NULL,
    `vehicle_id` INT UNSIGNED NULL,
    `status` ENUM('pending', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',

    -- Adresses
    `pickup_address` VARCHAR(500) NOT NULL,
    `pickup_lat` DECIMAL(10, 8) NOT NULL,
    `pickup_lng` DECIMAL(11, 8) NOT NULL,
    `dropoff_address` VARCHAR(500) NOT NULL,
    `dropoff_lat` DECIMAL(10, 8) NOT NULL,
    `dropoff_lng` DECIMAL(11, 8) NOT NULL,

    -- Estimations
    `estimated_distance_km` DECIMAL(10, 2) NULL,
    `estimated_duration_min` INT UNSIGNED NULL,
    `estimated_price` DECIMAL(10, 2) NULL,

    -- Final
    `final_distance_km` DECIMAL(10, 2) NULL,
    `final_duration_min` INT UNSIGNED NULL,
    `final_price` DECIMAL(10, 2) NULL,

    -- Route (polyline encodee)
    `route_polyline` TEXT NULL,

    -- Timestamps
    `accepted_at` TIMESTAMP NULL,
    `started_at` TIMESTAMP NULL,
    `completed_at` TIMESTAMP NULL,
    `cancelled_at` TIMESTAMP NULL,
    `cancellation_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`passenger_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`),

    INDEX `idx_rides_status` (`status`),
    INDEX `idx_rides_passenger` (`passenger_id`),
    INDEX `idx_rides_driver` (`driver_id`),
    INDEX `idx_rides_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table ride_positions (positions simulees du vehicule)
DROP TABLE IF EXISTS `ride_positions`;

CREATE TABLE `ride_positions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `ride_id` INT UNSIGNED NOT NULL,
    `lat` DECIMAL(10, 8) NOT NULL,
    `lng` DECIMAL(11, 8) NOT NULL,
    `heading` SMALLINT NULL COMMENT 'Direction en degres (0-360)',
    `speed` DECIMAL(5, 2) NULL COMMENT 'Vitesse en km/h',
    `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE,
    INDEX `idx_ride_positions_ride` (`ride_id`),
    INDEX `idx_ride_positions_recorded` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
