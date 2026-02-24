-- Migration: Ride PIN verification system
-- Date: 2026-02-24
-- Description: Table pour stocker les codes PIN de vérification de course

CREATE TABLE IF NOT EXISTS ride_pins (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    ride_id INT UNSIGNED NOT NULL,
    pin_hash VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt du PIN',
    attempts INT DEFAULT 0 COMMENT 'Nombre de tentatives (max 3)',
    expires_at DATETIME NOT NULL COMMENT 'Expiration du PIN (+10 min)',
    verified_at DATETIME NULL COMMENT 'Date de vérification réussie',
    sms_sent_at DATETIME NULL COMMENT 'Date envoi SMS',
    sms_status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, sent, failed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    UNIQUE KEY unique_ride_pin (ride_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les logs SMS (si pas déjà créée par SMSService)
CREATE TABLE IF NOT EXISTS sms_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_hash VARCHAR(64) NOT NULL COMMENT 'Hash SHA256 du numéro',
    message_type VARCHAR(20) NOT NULL DEFAULT 'general',
    twilio_sid VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_time (phone_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
