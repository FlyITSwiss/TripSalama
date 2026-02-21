-- TripSalama - Migration 009
-- Add soft delete columns to main tables

SET NAMES utf8mb4;

-- =============================================
-- USERS TABLE - Soft Delete
-- =============================================

-- Add deleted_at column if not exists
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deleted_at'),
    'SELECT 1',
    'ALTER TABLE `users` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for soft delete queries
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_deleted_at'),
    'SELECT 1',
    'ALTER TABLE `users` ADD INDEX `idx_users_deleted_at` (`deleted_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- VEHICLES TABLE - Soft Delete
-- =============================================

SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'deleted_at'),
    'SELECT 1',
    'ALTER TABLE `vehicles` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND INDEX_NAME = 'idx_vehicles_deleted_at'),
    'SELECT 1',
    'ALTER TABLE `vehicles` ADD INDEX `idx_vehicles_deleted_at` (`deleted_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- RIDES TABLE - Soft Delete
-- =============================================

SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND COLUMN_NAME = 'deleted_at'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND INDEX_NAME = 'idx_rides_deleted_at'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD INDEX `idx_rides_deleted_at` (`deleted_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- NOTES
-- =============================================
-- Usage in queries:
-- SELECT * FROM users WHERE deleted_at IS NULL;
--
-- To soft delete:
-- UPDATE users SET deleted_at = NOW() WHERE id = ?;
--
-- To restore:
-- UPDATE users SET deleted_at = NULL WHERE id = ?;
