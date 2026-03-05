-- TripSalama - Migration 019
-- Performance Indexes for critical queries
-- Run: mysql tripsalama < 019_performance_indexes.sql

SET NAMES utf8mb4;

-- =============================================
-- USERS TABLE - Additional Performance Indexes
-- =============================================

-- Composite index for driver search (role + active + verified)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_driver_active'),
    'SELECT 1',
    'ALTER TABLE `users` ADD INDEX `idx_users_driver_active` (`role`, `is_active`, `is_verified`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for phone lookups (SMS verification, 2FA)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_phone'),
    'SELECT 1',
    'ALTER TABLE `users` ADD INDEX `idx_users_phone` (`phone`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for last login analytics
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_last_login'),
    'SELECT 1',
    'ALTER TABLE `users` ADD INDEX `idx_users_last_login` (`last_login_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- RIDES TABLE - Analytics & Reporting Indexes
-- =============================================

-- Composite index for admin dashboard: date + status
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND INDEX_NAME = 'idx_rides_date_status'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD INDEX `idx_rides_date_status` (`created_at`, `status`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for completed rides with price (revenue calculation)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND INDEX_NAME = 'idx_rides_completed_price'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD INDEX `idx_rides_completed_price` (`status`, `completed_at`, `final_price`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for driver history (driver_id + completed_at)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rides' AND INDEX_NAME = 'idx_rides_driver_history'),
    'SELECT 1',
    'ALTER TABLE `rides` ADD INDEX `idx_rides_driver_history` (`driver_id`, `completed_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- RATINGS TABLE - Performance Indexes
-- =============================================

-- Index for average rating calculation
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ratings' AND INDEX_NAME = 'idx_ratings_ride'),
    'SELECT 1',
    'ALTER TABLE `ratings` ADD INDEX `idx_ratings_ride` (`ride_id`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- VEHICLES TABLE - Performance Indexes
-- =============================================

-- Index for active vehicles by driver
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND INDEX_NAME = 'idx_vehicles_driver_active'),
    'SELECT 1',
    'ALTER TABLE `vehicles` ADD INDEX `idx_vehicles_driver_active` (`driver_id`, `is_active`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- SESSIONS TABLE - Cleanup & Lookup Indexes
-- =============================================

-- Index for session expiry cleanup
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND INDEX_NAME = 'idx_sessions_expires'),
    'SELECT 1',
    'ALTER TABLE `sessions` ADD INDEX `idx_sessions_expires` (`expires_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- OTP_CODES TABLE - Verification Indexes
-- =============================================

-- Index for OTP lookup (user + valid + expires)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'otp_codes' AND INDEX_NAME = 'idx_otp_user_valid'),
    'SELECT 1',
    'ALTER TABLE `otp_codes` ADD INDEX `idx_otp_user_valid` (`user_id`, `is_used`, `expires_at`)'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- RATE_LIMITS TABLE - Cleanup Index
-- =============================================

-- Index for rate limit expiry cleanup
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rate_limits'),
    (SELECT IF(
        EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rate_limits' AND INDEX_NAME = 'idx_rate_limits_expires'),
        'SELECT 1',
        'ALTER TABLE `rate_limits` ADD INDEX `idx_rate_limits_expires` (`expires_at`)'
    )),
    'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- IDENTITY_VERIFICATIONS TABLE - Admin Review Index
-- =============================================

-- Index for pending verifications (admin dashboard)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'identity_verifications'),
    (SELECT IF(
        EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'identity_verifications' AND INDEX_NAME = 'idx_identity_pending'),
        'SELECT 1',
        'ALTER TABLE `identity_verifications` ADD INDEX `idx_identity_pending` (`status`, `created_at`)'
    )),
    'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- TRANSACTIONS TABLE - Reporting Indexes
-- =============================================

-- Index for transaction reporting (type + date)
SET @sql = (SELECT IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'),
    (SELECT IF(
        EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_report'),
        'SELECT 1',
        'ALTER TABLE `transactions` ADD INDEX `idx_transactions_report` (`type`, `created_at`, `amount`)'
    )),
    'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- ANALYSIS QUERIES (Run to verify indexes)
-- =============================================

-- Verify all indexes are created:
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
-- FROM INFORMATION_SCHEMA.STATISTICS
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- Check index usage after some traffic:
-- SELECT * FROM sys.schema_unused_indexes WHERE object_schema = DATABASE();

-- Check slow queries:
-- SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 20;
