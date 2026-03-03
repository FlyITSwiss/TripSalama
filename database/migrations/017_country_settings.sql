-- TripSalama - Migration 017: Country Settings
-- Gestion multi-pays avec activation/désactivation et fonctionnalités régionales

CREATE TABLE IF NOT EXISTS country_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL UNIQUE COMMENT 'Code ISO 3166-1 alpha-2',
    name VARCHAR(100) NOT NULL COMMENT 'Nom du pays',
    name_en VARCHAR(100) NOT NULL COMMENT 'Nom en anglais',

    -- Configuration devise
    currency VARCHAR(3) NOT NULL COMMENT 'Code devise ISO 4217',
    currency_symbol VARCHAR(5) NOT NULL COMMENT 'Symbole devise',
    currency_position ENUM('before', 'after') DEFAULT 'after' COMMENT 'Position du symbole',
    decimal_separator VARCHAR(1) DEFAULT ',' COMMENT 'Séparateur décimal',
    thousands_separator VARCHAR(1) DEFAULT ' ' COMMENT 'Séparateur milliers',

    -- Configuration région
    timezone VARCHAR(50) NOT NULL COMMENT 'Timezone IANA',
    default_lang VARCHAR(5) DEFAULT 'fr' COMMENT 'Langue par défaut',
    phone_prefix VARCHAR(5) NOT NULL COMMENT 'Préfixe téléphonique (+33, +212)',

    -- Statut
    is_active TINYINT(1) DEFAULT 1 COMMENT 'Pays activé pour les opérations',
    is_default TINYINT(1) DEFAULT 0 COMMENT 'Pays par défaut si détection échoue',

    -- Tarification
    base_price DECIMAL(10,2) NOT NULL COMMENT 'Prix de base course',
    price_per_km DECIMAL(10,2) NOT NULL COMMENT 'Prix par kilomètre',
    price_per_min DECIMAL(10,2) NOT NULL COMMENT 'Prix par minute',
    min_price DECIMAL(10,2) NOT NULL COMMENT 'Prix minimum course',

    -- Fonctionnalités régionales optionnelles
    prayer_times_enabled TINYINT(1) DEFAULT 0 COMMENT 'Horaires de prière activés',
    prayer_calculation_method INT DEFAULT 21 COMMENT 'Méthode calcul prière (21=Maroc)',
    arabic_enabled TINYINT(1) DEFAULT 0 COMMENT 'Langue arabe activée',

    -- Géofencing (bounding box)
    geo_min_lat DECIMAL(10,6) NULL COMMENT 'Latitude minimum',
    geo_max_lat DECIMAL(10,6) NULL COMMENT 'Latitude maximum',
    geo_min_lng DECIMAL(10,6) NULL COMMENT 'Longitude minimum',
    geo_max_lng DECIMAL(10,6) NULL COMMENT 'Longitude maximum',

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    -- Index
    INDEX idx_active (is_active),
    INDEX idx_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertion données initiales : France et Maroc
INSERT INTO country_settings (
    country_code, name, name_en, currency, currency_symbol, currency_position,
    decimal_separator, thousands_separator, timezone, default_lang, phone_prefix,
    is_active, is_default, base_price, price_per_km, price_per_min, min_price,
    prayer_times_enabled, prayer_calculation_method, arabic_enabled,
    geo_min_lat, geo_max_lat, geo_min_lng, geo_max_lng
) VALUES
-- France (pays par défaut pour Marseille)
(
    'FR', 'France', 'France', 'EUR', '€', 'after',
    ',', ' ', 'Europe/Paris', 'fr', '+33',
    1, 1, 2.50, 1.10, 0.20, 4.00,
    0, 2, 0,
    41.30, 51.10, -5.10, 9.60
),
-- Maroc
(
    'MA', 'Maroc', 'Morocco', 'MAD', 'DH', 'after',
    ',', ' ', 'Africa/Casablanca', 'fr', '+212',
    0, 0, 10.00, 5.00, 1.00, 15.00,
    1, 21, 1,
    27.60, 35.90, -13.20, -1.00
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    updated_at = NOW();

-- Vue pour faciliter les requêtes
CREATE OR REPLACE VIEW v_active_countries AS
SELECT
    country_code,
    name,
    currency,
    currency_symbol,
    timezone,
    is_default,
    base_price,
    price_per_km,
    price_per_min,
    prayer_times_enabled
FROM country_settings
WHERE is_active = 1
ORDER BY is_default DESC, name ASC;
