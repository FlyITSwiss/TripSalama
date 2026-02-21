-- TripSalama - Migration 008
-- Add geospatial indexes for location-based queries performance

SET NAMES utf8mb4;

-- =============================================
-- INDEXES FOR DRIVER_STATUS TABLE
-- =============================================

-- Composite index for availability + location queries (ignore if exists)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'driver_status' AND INDEX_NAME = 'idx_driver_status_available_location'),
    'SELECT 1',
    'ALTER TABLE `driver_status` ADD INDEX `idx_driver_status_available_location` (`is_available`, `current_lat`, `current_lng`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for last_update to clean up stale positions
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'driver_status' AND INDEX_NAME = 'idx_driver_status_last_update'),
    'SELECT 1',
    'ALTER TABLE `driver_status` ADD INDEX `idx_driver_status_last_update` (`last_update`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add heading and speed columns (ignore error if already exists)
-- Using separate statements for MySQL compatibility
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'driver_status' AND COLUMN_NAME = 'heading'),
    'SELECT 1',
    'ALTER TABLE `driver_status` ADD COLUMN `heading` SMALLINT NULL COMMENT "Direction en degrés (0-360)" AFTER `current_lng`'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'driver_status' AND COLUMN_NAME = 'speed'),
    'SELECT 1',
    'ALTER TABLE `driver_status` ADD COLUMN `speed` DECIMAL(5, 2) NULL COMMENT "Vitesse en km/h" AFTER `heading`'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- INDEXES FOR RIDES TABLE
-- =============================================

-- Composite index for pending rides near a location
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND INDEX_NAME = 'idx_rides_pending_pickup'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD INDEX `idx_rides_pending_pickup` (`status`, `pickup_lat`, `pickup_lng`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for active rides (driver_arriving, in_progress)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND INDEX_NAME = 'idx_rides_active'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD INDEX `idx_rides_active` (`status`, `driver_id`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- INDEXES FOR RIDE_POSITIONS TABLE
-- =============================================

-- Composite index for position lookup by ride
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ride_positions' AND INDEX_NAME = 'idx_ride_positions_location'),
    'SELECT 1',
    'ALTER TABLE `ride_positions` ADD INDEX `idx_ride_positions_location` (`ride_id`, `recorded_at`, `lat`, `lng`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- SPATIAL POINT COLUMN FOR DRIVER_STATUS (Optional - MySQL 5.7+)
-- Using POINT geometry for native spatial queries
-- =============================================

-- Note: For production use with MySQL 8.0+, you can use native POINT type:
-- ALTER TABLE `driver_status`
--     ADD COLUMN `location` POINT NULL SRID 4326,
--     ADD SPATIAL INDEX `idx_driver_status_spatial` (`location`);

-- Trigger to auto-update location POINT (MySQL 8.0+):
-- DELIMITER //
-- CREATE TRIGGER driver_status_update_location
-- BEFORE INSERT ON driver_status
-- FOR EACH ROW
-- BEGIN
--     IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
--         SET NEW.location = ST_SRID(POINT(NEW.current_lng, NEW.current_lat), 4326);
--     END IF;
-- END//
-- DELIMITER ;

-- =============================================
-- PERFORMANCE NOTES
-- =============================================
-- For high-traffic applications, consider:
-- 1. Using Redis for real-time driver positions
-- 2. Implementing geohashing for fast proximity queries
-- 3. Using PostGIS if switching to PostgreSQL
