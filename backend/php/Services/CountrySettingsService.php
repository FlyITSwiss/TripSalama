<?php

declare(strict_types=1);

namespace TripSalama\Services;

use PDO;
use TripSalama\Models\CountrySettings;

/**
 * TripSalama - Service de gestion des pays
 * Gère la configuration multi-pays, détection, et fonctionnalités régionales
 */
class CountrySettingsService
{
    private PDO $db;
    private CountrySettings $model;
    private ?array $currentCountry = null;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->model = new CountrySettings($db);
    }

    /**
     * Obtenir tous les pays (actifs et inactifs)
     */
    public function getAllCountries(): array
    {
        return $this->model->getAll();
    }

    /**
     * Obtenir les pays actifs uniquement
     */
    public function getActiveCountries(): array
    {
        return $this->model->getActive();
    }

    /**
     * Obtenir un pays par son code
     */
    public function getCountry(string $countryCode): ?array
    {
        return $this->model->getByCode($countryCode);
    }

    /**
     * Obtenir le pays par défaut
     */
    public function getDefaultCountry(): ?array
    {
        return $this->model->getDefault();
    }

    /**
     * Obtenir le pays actuel (session > détecté > défaut)
     */
    public function getCurrentCountry(): array
    {
        if ($this->currentCountry !== null) {
            return $this->currentCountry;
        }

        // Priorité 1: Session
        if (isset($_SESSION['country_code'])) {
            $country = $this->model->getByCode($_SESSION['country_code']);
            if ($country && (bool) $country['is_active']) {
                $this->currentCountry = $country;
                return $country;
            }
        }

        // Priorité 2: Pays par défaut
        $default = $this->model->getDefault();
        if ($default) {
            $this->currentCountry = $default;
            return $default;
        }

        // Fallback: Premier pays actif
        $active = $this->model->getActive();
        if (!empty($active)) {
            $this->currentCountry = $active[0];
            return $active[0];
        }

        // Fallback ultime: Configuration hardcodée
        return [
            'country_code' => 'FR',
            'name' => 'France',
            'currency' => 'EUR',
            'currency_symbol' => '€',
            'currency_position' => 'after',
            'decimal_separator' => ',',
            'thousands_separator' => ' ',
            'timezone' => 'Europe/Paris',
            'default_lang' => 'fr',
            'base_price' => 2.50,
            'price_per_km' => 1.10,
            'price_per_min' => 0.20,
            'min_price' => 4.00,
            'prayer_times_enabled' => 0,
            'arabic_enabled' => 0,
        ];
    }

    /**
     * Détecter le pays à partir des coordonnées GPS
     */
    public function detectFromCoordinates(float $lat, float $lng): ?array
    {
        $country = $this->model->detectFromCoordinates($lat, $lng);

        if ($country) {
            $this->setCurrentCountry($country['country_code']);
            return $country;
        }

        return null;
    }

    /**
     * Définir le pays actuel (stocké en session)
     */
    public function setCurrentCountry(string $countryCode): bool
    {
        $country = $this->model->getByCode($countryCode);

        if (!$country || !(bool) $country['is_active']) {
            return false;
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION['country_code'] = strtoupper($countryCode);
        }

        $this->currentCountry = $country;
        return true;
    }

    /**
     * Définir un pays comme pays par défaut
     */
    public function setDefaultCountry(string $countryCode): bool
    {
        return $this->model->setDefault($countryCode);
    }

    /**
     * Activer un pays
     */
    public function activateCountry(string $countryCode): bool
    {
        return $this->model->toggleActive($countryCode, true);
    }

    /**
     * Désactiver un pays
     */
    public function deactivateCountry(string $countryCode): bool
    {
        return $this->model->toggleActive($countryCode, false);
    }

    /**
     * Mettre à jour la configuration d'un pays
     */
    public function updateCountry(string $countryCode, array $data): bool
    {
        return $this->model->update($countryCode, $data);
    }

    /**
     * Activer/Désactiver les horaires de prière
     */
    public function togglePrayerTimes(string $countryCode, bool $enabled): bool
    {
        return $this->model->togglePrayerTimes($countryCode, $enabled);
    }

    /**
     * Activer/Désactiver la langue arabe
     */
    public function toggleArabic(string $countryCode, bool $enabled): bool
    {
        return $this->model->toggleArabic($countryCode, $enabled);
    }

    /**
     * Vérifier si les horaires de prière sont activés pour le pays actuel
     */
    public function isPrayerTimesEnabled(): bool
    {
        $country = $this->getCurrentCountry();
        return (bool) ($country['prayer_times_enabled'] ?? false);
    }

    /**
     * Vérifier si l'arabe est activé pour le pays actuel
     */
    public function isArabicEnabled(): bool
    {
        $country = $this->getCurrentCountry();
        return (bool) ($country['arabic_enabled'] ?? false);
    }

    /**
     * Obtenir la devise du pays actuel
     */
    public function getCurrentCurrency(): string
    {
        $country = $this->getCurrentCountry();
        return $country['currency'] ?? 'EUR';
    }

    /**
     * Obtenir le symbole de devise du pays actuel
     */
    public function getCurrentCurrencySymbol(): string
    {
        $country = $this->getCurrentCountry();
        return $country['currency_symbol'] ?? '€';
    }

    /**
     * Obtenir la timezone du pays actuel
     */
    public function getCurrentTimezone(): string
    {
        $country = $this->getCurrentCountry();
        return $country['timezone'] ?? 'Europe/Paris';
    }

    /**
     * Obtenir la tarification du pays actuel
     */
    public function getCurrentPricing(): array
    {
        $country = $this->getCurrentCountry();
        return [
            'base_price' => (float) ($country['base_price'] ?? 2.50),
            'price_per_km' => (float) ($country['price_per_km'] ?? 1.10),
            'price_per_min' => (float) ($country['price_per_min'] ?? 0.20),
            'min_price' => (float) ($country['min_price'] ?? 4.00),
        ];
    }

    /**
     * Formater un prix selon la configuration du pays actuel
     */
    public function formatPrice(float $amount): string
    {
        $country = $this->getCurrentCountry();
        return $this->model->formatPrice($amount, $country['country_code']);
    }

    /**
     * Obtenir les statistiques des pays
     */
    public function getStats(): array
    {
        $all = $this->model->getAll();
        $active = array_filter($all, fn($c) => (bool) $c['is_active']);
        $default = $this->model->getDefault();

        return [
            'total_countries' => count($all),
            'active_countries' => count($active),
            'default_country' => $default['country_code'] ?? 'N/A',
            'default_country_name' => $default['name'] ?? 'Non défini',
            'countries' => $all,
        ];
    }

    /**
     * Valider les données d'un pays
     */
    public function validateCountryData(array $data): array
    {
        $errors = [];

        if (isset($data['base_price']) && (float) $data['base_price'] < 0) {
            $errors['base_price'] = 'Le prix de base doit être positif';
        }

        if (isset($data['price_per_km']) && (float) $data['price_per_km'] < 0) {
            $errors['price_per_km'] = 'Le prix par km doit être positif';
        }

        if (isset($data['price_per_min']) && (float) $data['price_per_min'] < 0) {
            $errors['price_per_min'] = 'Le prix par minute doit être positif';
        }

        if (isset($data['min_price']) && (float) $data['min_price'] < 0) {
            $errors['min_price'] = 'Le prix minimum doit être positif';
        }

        return $errors;
    }
}
