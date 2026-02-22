-- TripSalama - Migration 007
-- Système de paiement complet (Wallet, Transactions, Méthodes de paiement)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- Table wallets (Portefeuille utilisateur)
-- ============================================
CREATE TABLE IF NOT EXISTS `wallets` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'MAD',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_wallets_user` (`user_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_wallets_balance` (`balance`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table payment_methods (Méthodes de paiement)
-- ============================================
CREATE TABLE IF NOT EXISTS `payment_methods` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `type` ENUM('card', 'apple_pay', 'google_pay', 'paypal', 'cash') NOT NULL,
    `provider` VARCHAR(50) NULL COMMENT 'stripe, paypal, etc.',
    `provider_payment_method_id` VARCHAR(255) NULL COMMENT 'ID chez le provider (pm_xxx pour Stripe)',
    `last_four` VARCHAR(4) NULL COMMENT 'Derniers 4 chiffres de la carte',
    `brand` VARCHAR(20) NULL COMMENT 'visa, mastercard, amex, etc.',
    `exp_month` TINYINT UNSIGNED NULL,
    `exp_year` SMALLINT UNSIGNED NULL,
    `holder_name` VARCHAR(100) NULL,
    `is_default` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_payment_methods_user` (`user_id`),
    INDEX `idx_payment_methods_default` (`user_id`, `is_default`),
    INDEX `idx_payment_methods_provider` (`provider_payment_method_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table transactions (Historique des transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `wallet_id` INT UNSIGNED NULL,
    `ride_id` INT UNSIGNED NULL,
    `type` ENUM('topup', 'payment', 'refund', 'commission', 'tip', 'promo', 'referral', 'withdrawal') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'MAD',
    `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    `payment_method_id` INT UNSIGNED NULL,
    `provider` VARCHAR(50) NULL COMMENT 'stripe, paypal, cash, wallet',
    `provider_transaction_id` VARCHAR(255) NULL COMMENT 'ID de transaction chez le provider',
    `provider_charge_id` VARCHAR(255) NULL COMMENT 'ID de charge chez le provider',
    `description` VARCHAR(500) NULL,
    `metadata` JSON NULL COMMENT 'Données supplémentaires',
    `error_message` VARCHAR(500) NULL,
    `processed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL,
    INDEX `idx_transactions_user` (`user_id`),
    INDEX `idx_transactions_wallet` (`wallet_id`),
    INDEX `idx_transactions_ride` (`ride_id`),
    INDEX `idx_transactions_status` (`status`),
    INDEX `idx_transactions_type` (`type`),
    INDEX `idx_transactions_created` (`created_at`),
    INDEX `idx_transactions_provider` (`provider_transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table promo_codes (Codes promotionnels)
-- ============================================
CREATE TABLE IF NOT EXISTS `promo_codes` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `discount_type` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    `discount_value` DECIMAL(10, 2) NOT NULL,
    `max_discount` DECIMAL(10, 2) NULL COMMENT 'Montant max de réduction (pour %)',
    `min_ride_amount` DECIMAL(10, 2) NULL COMMENT 'Montant minimum de course',
    `currency` VARCHAR(3) NOT NULL DEFAULT 'MAD',
    `max_uses` INT UNSIGNED NULL COMMENT 'Nombre max d''utilisations total',
    `max_uses_per_user` INT UNSIGNED NOT NULL DEFAULT 1,
    `current_uses` INT UNSIGNED NOT NULL DEFAULT 0,
    `valid_from` TIMESTAMP NULL,
    `valid_until` TIMESTAMP NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `is_first_ride_only` TINYINT(1) NOT NULL DEFAULT 0,
    `created_by` INT UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_promo_codes_code` (`code`),
    INDEX `idx_promo_codes_active` (`is_active`, `valid_from`, `valid_until`),
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table promo_code_uses (Utilisations des codes promo)
-- ============================================
CREATE TABLE IF NOT EXISTS `promo_code_uses` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `promo_code_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `ride_id` INT UNSIGNED NULL,
    `discount_applied` DECIMAL(10, 2) NOT NULL,
    `used_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE SET NULL,
    INDEX `idx_promo_uses_user` (`user_id`),
    INDEX `idx_promo_uses_code` (`promo_code_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table referrals (Parrainage)
-- ============================================
CREATE TABLE IF NOT EXISTS `referrals` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `referrer_id` INT UNSIGNED NOT NULL COMMENT 'Celui qui parraine',
    `referred_id` INT UNSIGNED NOT NULL COMMENT 'Celui qui est parrainé',
    `referral_code` VARCHAR(20) NOT NULL,
    `status` ENUM('pending', 'completed', 'expired') NOT NULL DEFAULT 'pending',
    `referrer_bonus` DECIMAL(10, 2) NULL COMMENT 'Bonus pour le parrain',
    `referred_bonus` DECIMAL(10, 2) NULL COMMENT 'Bonus pour le filleul',
    `currency` VARCHAR(3) NOT NULL DEFAULT 'MAD',
    `completed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`referred_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_referrals_referrer` (`referrer_id`),
    INDEX `idx_referrals_referred` (`referred_id`),
    INDEX `idx_referrals_code` (`referral_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Ajouter colonne referral_code à users
-- ============================================
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `referral_code` VARCHAR(20) NULL AFTER `remember_token`;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `referred_by` INT UNSIGNED NULL AFTER `referral_code`;
ALTER TABLE `users` ADD UNIQUE KEY IF NOT EXISTS `uk_users_referral_code` (`referral_code`);

-- ============================================
-- Ajouter colonnes paiement à rides
-- ============================================
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `payment_method` ENUM('wallet', 'card', 'cash', 'apple_pay', 'google_pay') NOT NULL DEFAULT 'cash' AFTER `final_price`;
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `payment_status` ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending' AFTER `payment_method`;
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `tip_amount` DECIMAL(10, 2) NULL AFTER `payment_status`;
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `promo_code_id` INT UNSIGNED NULL AFTER `tip_amount`;
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `discount_amount` DECIMAL(10, 2) NULL AFTER `promo_code_id`;
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `commission_amount` DECIMAL(10, 2) NULL AFTER `discount_amount`;
ALTER TABLE `rides` ADD COLUMN IF NOT EXISTS `driver_earnings` DECIMAL(10, 2) NULL AFTER `commission_amount`;

-- ============================================
-- Table scheduled_rides (Courses programmées)
-- ============================================
CREATE TABLE IF NOT EXISTS `scheduled_rides` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `passenger_id` INT UNSIGNED NOT NULL,
    `pickup_address` VARCHAR(500) NOT NULL,
    `pickup_lat` DECIMAL(10, 8) NOT NULL,
    `pickup_lng` DECIMAL(11, 8) NOT NULL,
    `dropoff_address` VARCHAR(500) NOT NULL,
    `dropoff_lat` DECIMAL(10, 8) NOT NULL,
    `dropoff_lng` DECIMAL(11, 8) NOT NULL,
    `scheduled_at` TIMESTAMP NOT NULL COMMENT 'Date/heure prévue',
    `vehicle_type` ENUM('standard', 'comfort', 'van', 'premium') NOT NULL DEFAULT 'standard',
    `estimated_price` DECIMAL(10, 2) NULL,
    `payment_method` ENUM('wallet', 'card', 'cash') NOT NULL DEFAULT 'cash',
    `status` ENUM('scheduled', 'searching', 'assigned', 'cancelled', 'completed') NOT NULL DEFAULT 'scheduled',
    `ride_id` INT UNSIGNED NULL COMMENT 'Lien vers la course créée',
    `driver_id` INT UNSIGNED NULL COMMENT 'Conductrice assignée',
    `notes` TEXT NULL,
    `reminder_sent` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`passenger_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_scheduled_rides_passenger` (`passenger_id`),
    INDEX `idx_scheduled_rides_scheduled` (`scheduled_at`),
    INDEX `idx_scheduled_rides_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table vehicle_types (Types de véhicules)
-- ============================================
CREATE TABLE IF NOT EXISTS `vehicle_types` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `icon` VARCHAR(50) NULL,
    `base_price_multiplier` DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    `per_km_multiplier` DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    `per_min_multiplier` DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    `min_price_multiplier` DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    `max_passengers` TINYINT UNSIGNED NOT NULL DEFAULT 4,
    `max_luggage` TINYINT UNSIGNED NOT NULL DEFAULT 2,
    `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_vehicle_types_code` (`code`),
    INDEX `idx_vehicle_types_active` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insérer les types de véhicules par défaut
INSERT INTO `vehicle_types` (`code`, `name`, `description`, `icon`, `base_price_multiplier`, `per_km_multiplier`, `max_passengers`, `max_luggage`, `sort_order`) VALUES
('standard', 'Standard', 'Véhicule confortable pour trajets quotidiens', 'car', 1.00, 1.00, 4, 2, 1),
('comfort', 'Confort', 'Véhicule spacieux avec plus d''espace', 'car-side', 1.20, 1.15, 4, 3, 2),
('van', 'Van', 'Idéal pour les groupes ou beaucoup de bagages', 'van-shuttle', 1.50, 1.30, 6, 5, 3),
('premium', 'Premium', 'Véhicule haut de gamme pour une expérience luxe', 'gem', 1.80, 1.50, 4, 3, 4)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Ajouter colonne vehicle_type à vehicles
ALTER TABLE `vehicles` ADD COLUMN IF NOT EXISTS `vehicle_type` VARCHAR(20) NOT NULL DEFAULT 'standard' AFTER `year`;

-- ============================================
-- Table sos_alerts (Alertes d'urgence)
-- ============================================
CREATE TABLE IF NOT EXISTS `sos_alerts` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `ride_id` INT UNSIGNED NULL,
    `alert_type` ENUM('sos', 'suspicious_stop', 'route_deviation', 'manual') NOT NULL DEFAULT 'manual',
    `status` ENUM('active', 'responding', 'resolved', 'false_alarm') NOT NULL DEFAULT 'active',
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `address` VARCHAR(500) NULL,
    `message` TEXT NULL,
    `contacts_notified` JSON NULL COMMENT 'Liste des contacts notifiés',
    `audio_recording_path` VARCHAR(255) NULL,
    `resolved_by` INT UNSIGNED NULL,
    `resolved_at` TIMESTAMP NULL,
    `resolution_notes` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_sos_alerts_user` (`user_id`),
    INDEX `idx_sos_alerts_ride` (`ride_id`),
    INDEX `idx_sos_alerts_status` (`status`),
    INDEX `idx_sos_alerts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table emergency_contacts (Contacts d'urgence)
-- ============================================
CREATE TABLE IF NOT EXISTS `emergency_contacts` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NULL,
    `relationship` VARCHAR(50) NULL,
    `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
    `notify_on_ride_start` TINYINT(1) NOT NULL DEFAULT 0,
    `notify_on_sos` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_emergency_contacts_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table ride_shares (Partage de trajet en temps réel)
-- ============================================
CREATE TABLE IF NOT EXISTS `ride_shares` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `ride_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `share_token` VARCHAR(64) NOT NULL,
    `shared_with_name` VARCHAR(100) NULL,
    `shared_with_phone` VARCHAR(30) NULL,
    `shared_with_email` VARCHAR(255) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `view_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `last_viewed_at` TIMESTAMP NULL,
    `expires_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY `uk_ride_shares_token` (`share_token`),
    FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_ride_shares_ride` (`ride_id`),
    INDEX `idx_ride_shares_token` (`share_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
