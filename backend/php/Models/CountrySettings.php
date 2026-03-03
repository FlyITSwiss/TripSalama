<?php

declare(strict_types=1);

namespace TripSalama\Models;

use PDO;

/**
 * TripSalama - Model CountrySettings
 * Gestion des paramètres par pays (devise, tarification, fonctionnalités)
 */
class CountrySettings
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Créer la table si elle n'existe pas
     */
    public function ensureTableExists(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS country_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                country_code VARCHAR(2) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                name_en VARCHAR(100) NOT NULL,
                currency VARCHAR(3) NOT NULL,
                currency_symbol VARCHAR(5) NOT NULL,
                currency_position ENUM('before', 'after') DEFAULT 'after',
                decimal_separator VARCHAR(1) DEFAULT ',',
                thousands_separator VARCHAR(1) DEFAULT ' ',
                timezone VARCHAR(50) NOT NULL,
                default_lang VARCHAR(5) DEFAULT 'fr',
                phone_prefix VARCHAR(5) NOT NULL,
                is_active TINYINT(1) DEFAULT 1,
                is_default TINYINT(1) DEFAULT 0,
                base_price DECIMAL(10,2) NOT NULL,
                price_per_km DECIMAL(10,2) NOT NULL,
                price_per_min DECIMAL(10,2) NOT NULL,
                min_price DECIMAL(10,2) NOT NULL,
                prayer_times_enabled TINYINT(1) DEFAULT 0,
                prayer_calculation_method INT DEFAULT 21,
                arabic_enabled TINYINT(1) DEFAULT 0,
                geo_min_lat DECIMAL(10,6) NULL,
                geo_max_lat DECIMAL(10,6) NULL,
                geo_min_lng DECIMAL(10,6) NULL,
                geo_max_lng DECIMAL(10,6) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Insérer les pays par défaut si table vide
        $stmt = $this->db->query("SELECT COUNT(*) FROM country_settings");
        if ((int) $stmt->fetchColumn() === 0) {
            $this->seedDefaultCountries();
        }
    }

    /**
     * Insérer les pays par défaut (France et Maroc)
     */
    private function seedDefaultCountries(): void
    {
        $countries = [
            [
                'country_code' => 'FR',
                'name' => 'France',
                'name_en' => 'France',
                'currency' => 'EUR',
                'currency_symbol' => '€',
                'currency_position' => 'after',
                'decimal_separator' => ',',
                'thousands_separator' => ' ',
                'timezone' => 'Europe/Paris',
                'default_lang' => 'fr',
                'phone_prefix' => '+33',
                'is_active' => 1,
                'is_default' => 1,
                'base_price' => 2.50,
                'price_per_km' => 1.10,
                'price_per_min' => 0.20,
                'min_price' => 4.00,
                'prayer_times_enabled' => 0,
                'prayer_calculation_method' => 2,
                'arabic_enabled' => 0,
                'geo_min_lat' => 41.30,
                'geo_max_lat' => 51.10,
                'geo_min_lng' => -5.10,
                'geo_max_lng' => 9.60,
            ],
            [
                'country_code' => 'MA',
                'name' => 'Maroc',
                'name_en' => 'Morocco',
                'currency' => 'MAD',
                'currency_symbol' => 'DH',
                'currency_position' => 'after',
                'decimal_separator' => ',',
                'thousands_separator' => ' ',
                'timezone' => 'Africa/Casablanca',
                'default_lang' => 'fr',
                'phone_prefix' => '+212',
                'is_active' => 0,
                'is_default' => 0,
                'base_price' => 10.00,
                'price_per_km' => 5.00,
                'price_per_min' => 1.00,
                'min_price' => 15.00,
                'prayer_times_enabled' => 1,
                'prayer_calculation_method' => 21,
                'arabic_enabled' => 1,
                'geo_min_lat' => 27.60,
                'geo_max_lat' => 35.90,
                'geo_min_lng' => -13.20,
                'geo_max_lng' => -1.00,
            ],
        ];

        $sql = "INSERT INTO country_settings (
            country_code, name, name_en, currency, currency_symbol, currency_position,
            decimal_separator, thousands_separator, timezone, default_lang, phone_prefix,
            is_active, is_default, base_price, price_per_km, price_per_min, min_price,
            prayer_times_enabled, prayer_calculation_method, arabic_enabled,
            geo_min_lat, geo_max_lat, geo_min_lng, geo_max_lng
        ) VALUES (
            :country_code, :name, :name_en, :currency, :currency_symbol, :currency_position,
            :decimal_separator, :thousands_separator, :timezone, :default_lang, :phone_prefix,
            :is_active, :is_default, :base_price, :price_per_km, :price_per_min, :min_price,
            :prayer_times_enabled, :prayer_calculation_method, :arabic_enabled,
            :geo_min_lat, :geo_max_lat, :geo_min_lng, :geo_max_lng
        )";

        $stmt = $this->db->prepare($sql);
        foreach ($countries as $country) {
            $stmt->execute($country);
        }
    }

    /**
     * Obtenir tous les pays
     */
    public function getAll(): array
    {
        $this->ensureTableExists();
        $stmt = $this->db->query("
            SELECT * FROM country_settings
            ORDER BY is_default DESC, name ASC
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir les pays actifs uniquement
     */
    public function getActive(): array
    {
        $this->ensureTableExists();
        $stmt = $this->db->query("
            SELECT * FROM country_settings
            WHERE is_active = 1
            ORDER BY is_default DESC, name ASC
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtenir un pays par son code
     */
    public function getByCode(string $countryCode): ?array
    {
        $this->ensureTableExists();
        $stmt = $this->db->prepare("SELECT * FROM country_settings WHERE country_code = :code");
        $stmt->execute(['code' => strtoupper($countryCode)]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    /**
     * Obtenir le pays par défaut
     */
    public function getDefault(): ?array
    {
        $this->ensureTableExists();
        $stmt = $this->db->query("SELECT * FROM country_settings WHERE is_default = 1 LIMIT 1");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    /**
     * Mettre à jour un pays
     */
    public function update(string $countryCode, array $data): bool
    {
        $this->ensureTableExists();

        $allowedFields = [
            'name', 'name_en', 'currency', 'currency_symbol', 'currency_position',
            'decimal_separator', 'thousands_separator', 'timezone', 'default_lang',
            'phone_prefix', 'is_active', 'is_default', 'base_price', 'price_per_km',
            'price_per_min', 'min_price', 'prayer_times_enabled', 'prayer_calculation_method',
            'arabic_enabled', 'geo_min_lat', 'geo_max_lat', 'geo_min_lng', 'geo_max_lng',
        ];

        $setClauses = [];
        $params = ['code' => strtoupper($countryCode)];

        foreach ($data as $key => $value) {
            if (in_array($key, $allowedFields, true)) {
                $setClauses[] = "$key = :$key";
                $params[$key] = $value;
            }
        }

        if (empty($setClauses)) {
            return false;
        }

        $sql = "UPDATE country_settings SET " . implode(', ', $setClauses) . " WHERE country_code = :code";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute($params);
    }

    /**
     * Définir un pays comme défaut (et retirer le défaut des autres)
     */
    public function setDefault(string $countryCode): bool
    {
        $this->ensureTableExists();

        // Retirer le défaut de tous les pays
        $this->db->exec("UPDATE country_settings SET is_default = 0");

        // Définir le nouveau défaut
        $stmt = $this->db->prepare("UPDATE country_settings SET is_default = 1, is_active = 1 WHERE country_code = :code");
        return $stmt->execute(['code' => strtoupper($countryCode)]);
    }

    /**
     * Activer/Désactiver un pays
     */
    public function toggleActive(string $countryCode, bool $active): bool
    {
        $this->ensureTableExists();

        // On ne peut pas désactiver le pays par défaut
        $country = $this->getByCode($countryCode);
        if ($country && (bool) $country['is_default'] && !$active) {
            return false;
        }

        $stmt = $this->db->prepare("UPDATE country_settings SET is_active = :active WHERE country_code = :code");
        return $stmt->execute([
            'code' => strtoupper($countryCode),
            'active' => $active ? 1 : 0,
        ]);
    }

    /**
     * Activer/Désactiver les horaires de prière pour un pays
     */
    public function togglePrayerTimes(string $countryCode, bool $enabled): bool
    {
        $this->ensureTableExists();
        $stmt = $this->db->prepare("UPDATE country_settings SET prayer_times_enabled = :enabled WHERE country_code = :code");
        return $stmt->execute([
            'code' => strtoupper($countryCode),
            'enabled' => $enabled ? 1 : 0,
        ]);
    }

    /**
     * Activer/Désactiver la langue arabe pour un pays
     */
    public function toggleArabic(string $countryCode, bool $enabled): bool
    {
        $this->ensureTableExists();
        $stmt = $this->db->prepare("UPDATE country_settings SET arabic_enabled = :enabled WHERE country_code = :code");
        return $stmt->execute([
            'code' => strtoupper($countryCode),
            'enabled' => $enabled ? 1 : 0,
        ]);
    }

    /**
     * Détecter le pays à partir des coordonnées GPS
     */
    public function detectFromCoordinates(float $lat, float $lng): ?array
    {
        $this->ensureTableExists();
        $stmt = $this->db->prepare("
            SELECT * FROM country_settings
            WHERE is_active = 1
              AND :lat BETWEEN geo_min_lat AND geo_max_lat
              AND :lng BETWEEN geo_min_lng AND geo_max_lng
            LIMIT 1
        ");
        $stmt->execute(['lat' => $lat, 'lng' => $lng]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    /**
     * Formater un prix selon la configuration du pays
     */
    public function formatPrice(float $amount, string $countryCode): string
    {
        $country = $this->getByCode($countryCode);
        if (!$country) {
            return number_format($amount, 2) . ' €';
        }

        $formatted = number_format(
            $amount,
            2,
            $country['decimal_separator'],
            $country['thousands_separator']
        );

        if ($country['currency_position'] === 'before') {
            return $country['currency_symbol'] . ' ' . $formatted;
        }

        return $formatted . ' ' . $country['currency_symbol'];
    }
}
