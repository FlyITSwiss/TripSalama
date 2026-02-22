-- TripSalama - Migration 006
-- Ajout des index spatiaux pour optimiser les requêtes géographiques

SET NAMES utf8mb4;

-- Index composites pour les recherches de proximité
-- Note: MySQL ne supporte pas les vrais index spatiaux sur DECIMAL
-- On utilise des index composites optimisés

-- Index sur les coordonnées des courses
CREATE INDEX IF NOT EXISTS idx_rides_pickup_geo ON rides(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_geo ON rides(dropoff_lat, dropoff_lng);
CREATE INDEX IF NOT EXISTS idx_rides_current_geo ON rides(current_lat, current_lng);

-- Index sur les coordonnées des conductrices
CREATE INDEX IF NOT EXISTS idx_driver_status_geo ON driver_status(current_lat, current_lng);

-- Index sur les positions de course (tracking)
CREATE INDEX IF NOT EXISTS idx_ride_positions_geo ON ride_positions(lat, lng);

-- Index sur les zones de géofencing (créée par le service)
-- La table est créée automatiquement par GeofencingService

-- Table pour le cache de géocodage (réduire les appels API)
CREATE TABLE IF NOT EXISTS geocode_cache (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    address_hash VARCHAR(64) NOT NULL UNIQUE,
    address_original VARCHAR(500) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    formatted_address VARCHAR(500) NULL,
    city VARCHAR(100) NULL,
    country_code CHAR(2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,

    INDEX idx_geocode_hash (address_hash),
    INDEX idx_geocode_expires (expires_at),
    INDEX idx_geocode_coords (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nettoyage automatique du cache (via événement MySQL)
-- DELIMITER //
-- CREATE EVENT IF NOT EXISTS cleanup_geocode_cache
-- ON SCHEDULE EVERY 1 DAY
-- DO
-- BEGIN
--     DELETE FROM geocode_cache WHERE expires_at < NOW();
-- END//
-- DELIMITER ;
