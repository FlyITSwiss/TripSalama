-- TripSalama - Migration 006
-- Vérification d'identité par caméra

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Ajouter colonnes à la table users
ALTER TABLE `users`
ADD COLUMN `identity_photo_path` VARCHAR(255) NULL AFTER `avatar_path`,
ADD COLUMN `identity_verified_at` TIMESTAMP NULL AFTER `email_verified_at`,
ADD COLUMN `identity_verification_status` ENUM('pending', 'verified', 'rejected', 'manual_review') DEFAULT 'pending' AFTER `identity_verified_at`;

-- Table pour historique des vérifications
DROP TABLE IF EXISTS `identity_verifications`;

CREATE TABLE `identity_verifications` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `photo_path` VARCHAR(255) NOT NULL,
    `ai_confidence` DECIMAL(5,4) NULL COMMENT 'Niveau de confiance de l\'IA (0.0000 - 1.0000)',
    `ai_result` ENUM('female', 'male', 'unknown') NULL COMMENT 'Résultat détection IA',
    `manual_review_by` INT UNSIGNED NULL COMMENT 'Admin ayant validé manuellement',
    `manual_review_at` TIMESTAMP NULL,
    `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    `rejection_reason` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX `idx_identity_verif_user` (`user_id`),
    INDEX `idx_identity_verif_status` (`status`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
