-- Migration: Driver safety checklist and SOS recordings
-- Date: 2026-02-24
-- Description: Tables pour la checklist sécurité conductrice et enregistrements SOS

-- Checklist quotidienne conductrice
CREATE TABLE IF NOT EXISTS driver_daily_checklist (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    driver_id INT UNSIGNED NOT NULL,
    check_date DATE NOT NULL,
    dashcam_photo_path VARCHAR(500) NULL COMMENT 'Photo preuve dashcam installée',
    dashcam_verified_at DATETIME NULL,
    checklist_items JSON NULL COMMENT '{"seatbelt": true, "mirror": true, "dashcam": true}',
    valid_until DATETIME NOT NULL COMMENT 'Validité jusqu à minuit',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_daily (driver_id, check_date),
    INDEX idx_valid_until (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des alertes SOS (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS sos_alerts (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    ride_id INT UNSIGNED NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    trigger_type VARCHAR(20) DEFAULT 'manual' COMMENT 'manual, automatic, anomaly',
    message TEXT NULL,
    status VARCHAR(20) DEFAULT 'active' COMMENT 'active, resolved, false_alarm',
    resolved_at DATETIME NULL,
    resolved_by INT UNSIGNED NULL,
    resolution_notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_user_ride (user_id, ride_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enregistrements SOS (vidéo/audio)
CREATE TABLE IF NOT EXISTS sos_recordings (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    sos_alert_id INT UNSIGNED NULL COMMENT 'Lié à une alerte SOS si applicable',
    user_id INT UNSIGNED NOT NULL,
    ride_id INT UNSIGNED NULL,
    recording_path VARCHAR(500) NOT NULL,
    recording_type VARCHAR(20) DEFAULT 'video' COMMENT 'video, audio',
    duration_seconds INT NULL,
    file_size_bytes BIGINT NULL,
    mime_type VARCHAR(100) NULL,
    upload_status VARCHAR(20) DEFAULT 'uploading' COMMENT 'uploading, completed, failed',
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    FOREIGN KEY (sos_alert_id) REFERENCES sos_alerts(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    INDEX idx_user_ride (user_id, ride_id),
    INDEX idx_status (upload_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table app_settings pour les paramètres admin
CREATE TABLE IF NOT EXISTS app_settings (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Pour ajouter checklist_valid_until à driver_status, exécuter manuellement si nécessaire:
-- ALTER TABLE driver_status ADD COLUMN checklist_valid_until DATETIME NULL COMMENT 'Validité checklist sécurité du jour';
